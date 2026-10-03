from datetime import timedelta

from collections import defaultdict
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import (
    IsAuthenticatedUser,
    IsPortalStaff,
    IsStoreStaff,
    is_full_admin,
    managed_warehouse,
)
from catalog.models import Category, Product
from cms.mailer import send_event, send_order_event, send_order_status_event
from orders.fulfillment import (
    FulfillmentError,
    allocate_quantity,
    apply_group_shipping,
    approve_fulfillment_request,
    assert_can_move,
    can_review_fulfillment,
    decrement_allocations,
    get_warehouse_settings,
    move_order_item,
    opposite_warehouse,
    reject_fulfillment_request,
    restock_order,
)
from orders.models import AccountingReset, ContactMessage, FulfillmentRequest, Order, OrderItem
from orders.serializers import FulfillmentRequestSerializer, OrderSerializer
from orders.btcpay import BtcPayError, create_invoice, is_configured, serialize_invoice
from orders.pay_token import checkout_url
from orders.accounting import TILE_KEYS, accounting_response, parse_accounting_warehouse, resolve_warehouse

logger = logging.getLogger(__name__)


def product_price(product: Product) -> float:
    if product.sale_price is not None and product.sale_price > 0:
        return product.sale_price
    return product.regular_price


def to_base36(number: int) -> str:
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if number == 0:
        return "0"
    digits = []
    while number:
        number, remainder = divmod(number, 36)
        digits.append(chars[remainder])
    return "".join(reversed(digits))


@api_view(["POST"])
@permission_classes([AllowAny])
def checkout_view(request):
    data = request.data
    items = data.get("items") or []
    if not items:
        return Response({"error": "Cart is empty."}, status=400)
    required = ["name", "email", "line1", "city", "state", "postal"]
    if any(not data.get(field) for field in required):
        return Response({"error": "Shipping details are required."}, status=400)
    if not is_configured():
        return Response(
            {
                "error": "Bitcoin checkout is not configured. Connect BTCPay Server in Admin → CMS → BTCPay."
            },
            status=503,
        )

    product_ids = [item.get("productId") for item in items]
    with transaction.atomic():
        products = {
            str(p.id): p
            for p in Product.objects.select_for_update().filter(id__in=product_ids)
        }
        policy = get_warehouse_settings()
        lines = []
        stock_ops = []
        try:
            for item in items:
                product = products.get(str(item.get("productId")))
                if not product:
                    return Response({"error": "One or more products are unavailable."}, status=400)
                quantity = max(1, int(item.get("quantity") or 1))
                unit_price = product_price(product)
                for warehouse, qty in allocate_quantity(product, quantity, policy):
                    lines.append(
                        {
                            "product": product,
                            "quantity": qty,
                            "unit_price": unit_price,
                            "line_total": unit_price * qty,
                            "warehouse": warehouse,
                        }
                    )
                    stock_ops.append((product, warehouse, qty))
        except FulfillmentError as exc:
            return Response({"error": str(exc)}, status=400)

        merchandise_total = sum(line["line_total"] for line in lines)
        if merchandise_total < settings.MIN_ORDER_USD:
            return Response(
                {"error": f"${settings.MIN_ORDER_USD} minimum order on merchandise."},
                status=400,
            )

        decrement_allocations(stock_ops)

        referral_code = data.get("referralCode") or request.COOKIES.get("invictus-ref")
        affiliate = None
        if referral_code:
            affiliate = User.objects.filter(
                affiliate_code=referral_code, is_affiliate=True
            ).first()

        email = data["email"].strip().lower()
        first_order_discount = False
        if affiliate:
            prior = Order.objects.filter(affiliate=affiliate, customer_email=email).count()
            first_order_discount = prior == 0

        grouped = defaultdict(list)
        for line in lines:
            grouped[line["warehouse"]].append(line)

        group_id = f"INV-{to_base36(int(timezone.now().timestamp() * 1000))}"
        created = []
        session_user = request.user if request.user.is_authenticated else None

        for index, warehouse in enumerate(grouped.keys()):
            group_lines = grouped[warehouse]
            merch = sum(line["line_total"] for line in group_lines)
            if first_order_discount:
                merch = round(merch * (1 - settings.FIRST_ORDER_AFFILIATE_DISCOUNT), 2)
            commission_amount = 0
            if affiliate:
                if affiliate.commission_type == User.CommissionType.FIXED:
                    commission_amount = affiliate.commission_rate
                else:
                    commission_amount = round((merch * affiliate.commission_rate) / 100, 2)
            suffix = "W1" if warehouse == Product.Warehouse.WAREHOUSE_1 else "W2"
            order = Order.objects.create(
                order_number=f"{group_id}-{suffix}",
                group_id=group_id,
                split_index=index + 1,
                warehouse=warehouse,
                user=session_user if session_user and not getattr(session_user, "is_anonymous", False) else None,
                status=Order.Status.PENDING,
                payment_status=Order.PaymentStatus.PENDING,
                payment_method="btc",
                merchandise_total=merch,
                shipping_total=0,
                grand_total=merch,
                customer_name=data["name"],
                customer_email=email,
                shipping_line1=data["line1"],
                shipping_line2=data.get("line2") or "",
                shipping_city=data["city"],
                shipping_state=data["state"],
                shipping_postal=data["postal"],
                notes=data.get("notes") or "",
                affiliate=affiliate,
                commission_amount=commission_amount,
            )
            for line in group_lines:
                OrderItem.objects.create(
                    order=order,
                    product=line["product"],
                    name=line["product"].name,
                    sku=line["product"].sku or "",
                    unit_price=line["unit_price"],
                    quantity=line["quantity"],
                    line_total=line["line_total"],
                    warehouse=line["warehouse"],
                )
            created.append(order)

        apply_group_shipping(group_id)

    payload = []
    checkout_link = None
    invoice_error = None
    for order in created:
        order.refresh_from_db()
        invoice_payload = None
        try:
            invoice = create_invoice(order)
            invoice_payload = serialize_invoice(invoice)
            link = invoice_payload.get("checkoutLink") if invoice_payload else None
            if not checkout_link and link:
                checkout_link = link
        except BtcPayError as exc:
            logger.exception("BTCPay invoice failed for %s", order.order_number)
            invoice_error = str(exc)
            invoice_payload = {"error": str(exc)}
        send_order_event("order_placed", order)
        payload.append(
            {
                "id": str(order.id),
                "orderNumber": order.order_number,
                "warehouse": order.warehouse,
                "grandTotal": order.grand_total,
                "checkoutLink": (invoice_payload or {}).get("checkoutLink"),
                "payUrl": checkout_url(order),
                "invoice": invoice_payload,
            }
        )

    return Response({"ok": True, "groupId": group_id, "checkoutLink": checkout_link, "orders": payload, "error": invoice_error})


@api_view(["POST"])
@permission_classes([AllowAny])
def contact_view(request):
    required = ["name", "email", "subject", "message"]
    if any(not request.data.get(field) for field in required):
        return Response({"error": "All fields are required."}, status=400)
    ContactMessage.objects.create(
        name=request.data["name"],
        email=request.data["email"],
        subject=request.data["subject"],
        message=request.data["message"],
    )
    send_event(
        "contact_received",
        {
            "user_name": request.data["name"],
            "user_email": request.data["email"],
            "subject": request.data["subject"],
            "message": request.data["message"],
        },
        user_email=request.data["email"],
    )
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
def account_orders_view(request):
    qs = (
        Order.objects.filter(user=request.user)
        | Order.objects.filter(customer_email=request.user.email)
    )
    qs = qs.prefetch_related("items", "btc_invoices").distinct()
    return Response(OrderSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
def account_affiliate_view(request):
    user = request.user
    if not user.is_affiliate:
        return Response({"error": "Not an affiliate."}, status=403)
    orders = Order.objects.filter(affiliate=user)
    referred_users = user.referred_users.all()
    return Response(
        {
            "affiliateCode": user.affiliate_code,
            "commissionType": user.commission_type,
            "commissionRate": user.commission_rate,
            "payoutType": user.payout_type,
            "referredOrders": OrderSerializer(orders, many=True).data,
            "referredUsers": [
                {"id": str(item.id), "name": item.name, "email": item.email}
                for item in referred_users
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
def account_summary_view(request):
    from accounts.models import AffiliateApplication

    orders = Order.objects.filter(user=request.user)[:8]
    application = (
        AffiliateApplication.objects.filter(user=request.user).order_by("-created_at").first()
    )
    return Response(
        {
            "orders": OrderSerializer(orders, many=True).data,
            "application": (
                {"id": str(application.id), "status": application.status}
                if application
                else None
            ),
        }
    )


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_orders_view(request):
    qs = Order.objects.prefetch_related("items", "btc_invoices", "shipping_labels").all()
    warehouse = managed_warehouse(request.user)
    if warehouse:
        qs = qs.filter(warehouse=warehouse)
    requested_warehouse = request.GET.get("warehouse")
    if not warehouse and requested_warehouse in (
        Order.Warehouse.WAREHOUSE_1,
        Order.Warehouse.WAREHOUSE_2,
    ):
        qs = qs.filter(warehouse=requested_warehouse)
    status = request.GET.get("status")
    if status and status not in ("all", ""):
        qs = qs.filter(status=status.upper())
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(order_number__icontains=q)
            | Q(customer_name__icontains=q)
            | Q(customer_email__icontains=q)
            | Q(tracking_number__icontains=q)
        )
    date_from = request.GET.get("dateFrom")
    date_to = request.GET.get("dateTo")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    base = Order.objects.all()
    if warehouse:
        base = base.filter(warehouse=warehouse)
    elif requested_warehouse in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
        base = base.filter(warehouse=requested_warehouse)
    counts = {"all": base.count()}
    for choice, _label in Order.Status.choices:
        counts[choice.lower()] = base.filter(status=choice).count()
    return Response({"orders": OrderSerializer(qs[:300], many=True).data, "counts": counts})


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_order_detail_view(request, pk):
    qs = Order.objects.prefetch_related("items", "btc_invoices", "shipping_labels")
    warehouse = managed_warehouse(request.user)
    if warehouse:
        qs = qs.filter(warehouse=warehouse)
    order = qs.filter(pk=pk).first()
    if not order:
        return Response({"error": "Not found."}, status=404)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def admin_order_status_view(request, pk):
    order = Order.objects.filter(pk=pk).first()
    if not order:
        return Response({"error": "Not found."}, status=404)
    warehouse = managed_warehouse(request.user)
    if warehouse and order.warehouse != warehouse:
        return Response({"error": "Not found."}, status=404)
    status = request.data.get("status")
    valid = {choice[0] for choice in Order.Status.choices}
    if status not in valid:
        return Response({"error": "Invalid status."}, status=400)
    previous = order.status
    order.status = status
    if status in (Order.Status.SHIPPED, Order.Status.DELIVERED) and not order.shipped_at:
        order.shipped_at = timezone.now()
    order.save()
    if previous != Order.Status.CANCELLED and status == Order.Status.CANCELLED:
        restock_order(order)
        apply_group_shipping(order.group_id)
    send_order_status_event(order)
    return Response({"ok": True, "status": order.status})


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def admin_order_move_item(request, pk):
    order = Order.objects.filter(pk=pk).first()
    if not order:
        return Response({"error": "Not found."}, status=404)
    item = order.items.filter(pk=request.data.get("itemId")).first()
    if not item:
        return Response({"error": "Item not found."}, status=404)
    dest = request.data.get("destWarehouse") or opposite_warehouse(order.warehouse)
    quantity = int(request.data.get("quantity") or 0)
    try:
        assert_can_move(request.user, order.warehouse, immediate=True)
        move_order_item(item, dest, quantity)
    except FulfillmentError as exc:
        return Response({"error": str(exc)}, status=400)
    refreshed = Order.objects.prefetch_related("items").filter(group_id=order.group_id)
    return Response(OrderSerializer(refreshed, many=True).data)


@api_view(["GET", "POST"])
@permission_classes([IsPortalStaff])
def admin_fulfillment_requests(request):
    if request.method == "POST":
        order = Order.objects.filter(pk=request.data.get("orderId")).first()
        if not order:
            return Response({"error": "Order not found."}, status=404)
        item = order.items.filter(pk=request.data.get("itemId")).first()
        if not item:
            return Response({"error": "Item not found."}, status=404)
        quantity = int(request.data.get("quantity") or 0)
        if quantity < 1 or quantity > item.quantity:
            return Response({"error": "Invalid quantity."}, status=400)
        dest = opposite_warehouse(order.warehouse)
        try:
            assert_can_move(request.user, order.warehouse, immediate=False)
        except FulfillmentError as exc:
            return Response({"error": str(exc)}, status=400)
        warehouse = managed_warehouse(request.user)
        if warehouse and order.warehouse != warehouse and not is_full_admin(request.user):
            return Response({"error": "Not allowed."}, status=403)
        row = FulfillmentRequest.objects.create(
            order=order,
            order_item=item,
            quantity=quantity,
            from_warehouse=order.warehouse,
            to_warehouse=dest,
            note=request.data.get("note") or "",
            requested_by=request.user,
        )
        return Response(FulfillmentRequestSerializer(row).data, status=201)
    qs = FulfillmentRequest.objects.select_related(
        "order", "order_item", "requested_by", "reviewed_by"
    )
    warehouse = managed_warehouse(request.user)
    if warehouse:
        qs = qs.filter(Q(from_warehouse=warehouse) | Q(to_warehouse=warehouse))
    return Response(FulfillmentRequestSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def admin_fulfillment_request_review(request, pk):
    row = FulfillmentRequest.objects.select_related("order", "order_item").filter(pk=pk).first()
    if not row:
        return Response({"error": "Not found."}, status=404)
    if not can_review_fulfillment(request.user, row.to_warehouse):
        return Response({"error": "You cannot review this request."}, status=403)
    action = request.data.get("action")
    try:
        if action == "approve":
            approve_fulfillment_request(row, request.user)
        elif action == "reject":
            reject_fulfillment_request(row, request.user)
        else:
            return Response({"error": "Invalid action."}, status=400)
    except FulfillmentError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response(FulfillmentRequestSerializer(row).data)


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_overview_view(request):
    from accounts.models import AffiliateApplication, User

    PAID_LIKE = [
        Order.Status.PAID,
        Order.Status.PROCESSING,
        Order.Status.SHIPPED,
        Order.Status.DELIVERED,
    ]
    OPEN = [
        Order.Status.PENDING,
        Order.Status.ON_HOLD,
        Order.Status.PAID,
        Order.Status.PROCESSING,
    ]

    user_count_qs = User.objects.all()
    if request.user.role != User.Role.SUPERUSER:
        user_count_qs = user_count_qs.exclude(role=User.Role.SUPERUSER)
    warehouse = managed_warehouse(request.user) or parse_accounting_warehouse(
        request.GET.get("warehouse")
    )
    scoped = warehouse in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2)
    orders_qs = Order.objects.all()
    open_qs = Order.objects.filter(status__in=OPEN)
    paid_qs = Order.objects.filter(status__in=PAID_LIKE)
    if scoped:
        orders_qs = orders_qs.filter(warehouse=warehouse)
        open_qs = open_qs.filter(warehouse=warehouse)
        paid_qs = paid_qs.filter(warehouse=warehouse)
    else:
        warehouse = "BOTH"

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    reset = AccountingReset.objects.order_by("-reset_at").first()
    reset_at = reset.reset_at if reset else None
    shipping_reset_qs = paid_qs
    if reset_at:
        shipping_reset_qs = paid_qs.filter(created_at__gte=reset_at)

    if warehouse == Order.Warehouse.WAREHOUSE_1:
        low_stock = Product.objects.filter(stock_quantity_w1__lte=5).count()
    elif warehouse == Order.Warehouse.WAREHOUSE_2:
        low_stock = Product.objects.filter(stock_quantity_w2__lte=5).count()
    else:
        low_stock = Product.objects.filter(stock_quantity__lte=5).count()

    month_items = OrderItem.objects.filter(
        order__status__in=PAID_LIKE,
        order__created_at__gte=month_start,
    )
    if scoped:
        month_items = month_items.filter(order__warehouse=warehouse)
    top = (
        month_items.values("product__categories__name")
        .annotate(total=Sum("quantity"))
        .order_by("-total")
        .first()
    )
    top_name = (top or {}).get("product__categories__name") or "—"
    top_count = int((top or {}).get("total") or 0)

    settings_row = get_warehouse_settings()

    def warehouse_card(code: str) -> dict:
        w_open = Order.objects.filter(warehouse=code, status__in=OPEN)
        if code == Order.Warehouse.WAREHOUSE_1:
            name = settings_row.w1_name or "Warehouse 1"
            contact = settings_row.w1_contact
            notes = settings_row.w1_notes
            low = Product.objects.filter(stock_quantity_w1__lte=5).count()
        else:
            name = settings_row.w2_name or "Warehouse 2"
            contact = settings_row.w2_contact
            notes = settings_row.w2_notes
            low = Product.objects.filter(stock_quantity_w2__lte=5).count()
        return {
            "code": code,
            "name": name,
            "contact": contact,
            "notes": notes,
            "productCount": Product.objects.filter(warehouse=code).count(),
            "lowStockCount": low,
            "processingCount": Order.objects.filter(
                warehouse=code, status=Order.Status.PROCESSING
            ).count(),
            "openOrderCount": w_open.count(),
            "openOrderValue": w_open.aggregate(total=Sum("grand_total"))["total"] or 0,
        }

    warehouses = [
        warehouse_card(Order.Warehouse.WAREHOUSE_1),
        warehouse_card(Order.Warehouse.WAREHOUSE_2),
    ]
    if scoped:
        warehouses = [row for row in warehouses if row["code"] == warehouse]

    open_total = open_qs.aggregate(total=Sum("grand_total"))["total"] or 0
    orders = orders_qs[:8]
    return Response(
        {
            "productCount": Product.objects.count(),
            "openOrderValue": open_total,
            "openOrderCount": open_qs.count(),
            "orderCount": orders_qs.exclude(
                status__in=[
                    Order.Status.PENDING,
                    Order.Status.ON_HOLD,
                    Order.Status.CANCELLED,
                    Order.Status.FAILED,
                ]
            ).count(),
            "lowStockCount": low_stock,
            "pendingAffiliates": AffiliateApplication.objects.filter(status="pending").count(),
            "userCount": user_count_qs.count(),
            "warehouse": warehouse,
            "salesToday": paid_qs.filter(created_at__gte=today_start).aggregate(
                total=Sum("merchandise_total")
            )["total"]
            or 0,
            "salesThisMonth": paid_qs.filter(created_at__gte=month_start).aggregate(
                total=Sum("merchandise_total")
            )["total"]
            or 0,
            "shippingSinceReset": shipping_reset_qs.aggregate(total=Sum("shipping_total"))["total"]
            or 0,
            "shippingThisWeek": paid_qs.filter(created_at__gte=week_start).aggregate(
                total=Sum("shipping_total")
            )["total"]
            or 0,
            "ordersPending": orders_qs.filter(status=Order.Status.PENDING).count(),
            "ordersProcessing": orders_qs.filter(status=Order.Status.PROCESSING).count(),
            "ordersCompleted": orders_qs.filter(
                status__in=[Order.Status.SHIPPED, Order.Status.DELIVERED]
            ).count(),
            "topCategoryMonth": {"name": top_name, "count": top_count},
            "categoriesTotal": Category.objects.count(),
            "warehousesTotal": 2,
            "couponsTotal": 0,
            "giftCardsTotal": 0,
            "customersTotal": User.objects.filter(role=User.Role.CUSTOMER).count(),
            "storeCreditAvailable": 0,
            "warehouses": warehouses,
            "orders": OrderSerializer(orders, many=True).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_accounting_view(request):
    return Response(
        accounting_response(
            request.user,
            request.GET.get("period") or "DAY",
            request.GET.get("warehouse"),
        )
    )


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_accounting_reset_view(request):
    tile_key = request.data.get("tileKey")
    period = request.data.get("period")
    warehouse = resolve_warehouse(request.user, request.data.get("warehouse"))
    if tile_key not in TILE_KEYS or period not in ("DAY", "WEEK", "MONTH"):
        return Response({"error": "Invalid tile or period."}, status=400)
    AccountingReset.objects.update_or_create(
        tile_key=tile_key,
        period=period,
        warehouse=warehouse,
        defaults={"reset_at": timezone.now(), "reset_by_id": str(request.user.id)},
    )
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def admin_orders_bulk_status_view(request):
    status = request.data.get("status")
    ids = request.data.get("ids") or []
    valid = {choice[0] for choice in Order.Status.choices}
    if status not in valid:
        return Response({"error": "Invalid status."}, status=400)
    warehouse = managed_warehouse(request.user)
    qs = Order.objects.filter(pk__in=ids)
    if warehouse:
        qs = qs.filter(warehouse=warehouse)
    updated = 0
    for order in qs:
        previous = order.status
        order.status = status
        if status in (Order.Status.SHIPPED, Order.Status.DELIVERED) and not order.shipped_at:
            order.shipped_at = timezone.now()
        order.save()
        if previous != Order.Status.CANCELLED and status == Order.Status.CANCELLED:
            restock_order(order)
            apply_group_shipping(order.group_id)
        send_order_status_event(order)
        updated += 1
    return Response({"ok": True, "updated": updated})


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def admin_order_tracking_view(request, pk):
    from orders.bitcoinpostage import tracking_url_for
    from orders.models import ShippingLabel

    order = Order.objects.filter(pk=pk).first()
    if not order:
        return Response({"error": "Not found."}, status=404)
    warehouse = managed_warehouse(request.user)
    if warehouse and order.warehouse != warehouse:
        return Response({"error": "Not found."}, status=404)
    tracking = str(request.data.get("trackingNumber") or "").strip()
    carrier = str(request.data.get("carrier") or "USPS").strip() or "USPS"
    order.tracking_number = tracking
    if tracking and not order.shipped_at:
        order.status = Order.Status.SHIPPED
        order.shipped_at = timezone.now()
    order.save()
    if tracking:
        ShippingLabel.objects.create(
            order=order,
            tracking_number=tracking,
            tracking_url=tracking_url_for(carrier, tracking),
            carrier=carrier.upper(),
            source=ShippingLabel.Source.MANUAL,
        )
    return Response(OrderSerializer(order).data)


@api_view(["GET", "PUT", "POST"])
@permission_classes([IsStoreStaff])
def admin_accounting_split_view(request):
    from orders.accounting import get_split_rates, reset_split, save_split, split_public, validate_split

    if request.method == "GET":
        return Response(split_public(get_split_rates()))
    if request.method == "POST" and request.data.get("reset"):
        return Response(split_public(reset_split()))
    parsed, error = validate_split(request.data if isinstance(request.data, dict) else {})
    if error:
        return Response({"error": error, **split_public(parsed)}, status=400)
    save_split(parsed)
    return Response(split_public(parsed))
