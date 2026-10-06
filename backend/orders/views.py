from datetime import timedelta

from collections import defaultdict
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
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
from cms.dashboard_tiles import resolve_tiles
from cms.ops_settings import get_json
from orders.analytics import (
    REVENUE_ELIGIBLE,
    catalog_stock_counts,
    completed_this_week_q,
    dashboard_period_labels,
    dashboard_week_bounds,
)
from orders.status import (
    OPEN_STATUSES,
    PROCESSING_LIKE,
    canonical_status,
    stamp_if_completed,
    statuses_for_tab,
    tab_counts,
)
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
from orders.coupons import bump_usage, discount_for, is_free_shipping, resolve_coupon
from orders.models import AccountingReset, ContactMessage, Coupon, FulfillmentRequest, Order, OrderItem
from orders.order_numbers import allocate_group_id
from orders.serializers import (
    FulfillmentRequestSerializer,
    OrderSerializer,
    group_customer_order_payloads,
)
from orders.shop_config import checkout_limit_error, resolve_shipping_option
from orders.btcpay import BtcPayError, create_invoice, is_configured, serialize_invoice
from orders.pay_token import checkout_url
from orders.accounting import TILE_KEYS, accounting_response, parse_accounting_warehouse, resolve_warehouse
from orders.totals import affiliate_commission, allocate_weighted, customer_checkout_totals, money

logger = logging.getLogger(__name__)


def product_price(product: Product) -> float:
    if product.sale_price is not None and product.sale_price > 0:
        return product.sale_price
    return product.regular_price


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

        coupon = None
        coupon_code = (data.get("couponCode") or "").strip()
        if coupon_code:
            coupon, coupon_error = resolve_coupon(coupon_code, merchandise_total)
            if coupon_error:
                return Response({"error": coupon_error}, status=400)

        shipping_choice = resolve_shipping_option(
            data.get("shippingOptionId") or data.get("shipping_option_id")
        )
        if shipping_choice is None:
            return Response({"error": "Select a valid shipping option."}, status=400)
        shipping_usd = float(shipping_choice["fee"])

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

        after_affiliate = merchandise_total
        if first_order_discount:
            after_affiliate = money(
                merchandise_total * (1 - settings.FIRST_ORDER_AFFILIATE_DISCOUNT)
            )
        coupon_discount = discount_for(coupon, after_affiliate) if coupon else 0.0
        totals = customer_checkout_totals(
            merchandise_total,
            affiliate_discount_rate=settings.FIRST_ORDER_AFFILIATE_DISCOUNT if first_order_discount else 0.0,
            coupon_discount=coupon_discount,
            free_shipping=is_free_shipping(coupon),
            shipping_usd=shipping_usd,
        )
        limit_error = checkout_limit_error(
            charged_merchandise=float(totals["merchandise"]),
            shipping=float(totals["shipping"]),
        )
        if limit_error:
            return Response({"error": limit_error}, status=400)

        try:
            group_id = allocate_group_id()
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)

        decrement_allocations(stock_ops)

        grouped = defaultdict(list)
        for line in lines:
            grouped[line["warehouse"]].append(line)

        created = []
        session_user = request.user if request.user.is_authenticated else None
        warehouse_groups = [(warehouse, group_lines) for warehouse, group_lines in grouped.items()]
        weights = [sum(line["line_total"] for line in group_lines) for _, group_lines in warehouse_groups]
        merch_shares = allocate_weighted(float(totals["merchandise"]), weights)
        discount_shares = allocate_weighted(float(totals["discount_total"]), weights)
        group_commission = 0.0
        if affiliate:
            group_commission = affiliate_commission(
                float(totals["merchandise"]),
                commission_type=affiliate.commission_type,
                rate=float(affiliate.commission_rate or 0),
            )
        commission_shares = (
            allocate_weighted(group_commission, merch_shares)
            if affiliate and affiliate.commission_type != User.CommissionType.FIXED
            else [group_commission if index == 0 else 0.0 for index in range(len(warehouse_groups))]
        )
        waived = bool(totals["shipping_waived"])

        for index, (warehouse, group_lines) in enumerate(warehouse_groups):
            merch_after = merch_shares[index]
            share_disc = discount_shares[index]
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
                merchandise_total=merch_after,
                shipping_total=0,
                grand_total=merch_after,
                customer_name=data["name"],
                customer_email=email,
                shipping_line1=data["line1"],
                shipping_line2=data.get("line2") or "",
                shipping_city=data["city"],
                shipping_state=data["state"],
                shipping_postal=data["postal"],
                notes=data.get("notes") or "",
                affiliate=affiliate,
                commission_amount=commission_shares[index],
                coupon=coupon,
                coupon_code=coupon.code if coupon else "",
                discount_total=share_disc,
                shipping_waived=waived,
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

        if coupon:
            bump_usage(coupon)
        apply_group_shipping(group_id, shipping_usd=float(totals["shipping"]))

    payload = []
    checkout_link = None
    invoice_error = None
    invoice_payload = None
    created.sort(key=lambda row: (row.split_index, str(row.id)))
    primary = created[0] if created else None
    if primary:
        primary.refresh_from_db()
        try:
            invoice = create_invoice(primary)
            invoice_payload = serialize_invoice(invoice)
            checkout_link = invoice_payload.get("checkoutLink") if invoice_payload else None
        except BtcPayError as exc:
            logger.exception("BTCPay invoice failed for %s", primary.order_number)
            invoice_error = str(exc)
            invoice_payload = {"error": str(exc)}
        send_order_event("order_placed", primary)

    group_total = 0.0
    for order in created:
        order.refresh_from_db()
        group_total += float(order.grand_total)
        payload.append(
            {
                "id": str(order.id),
                "orderNumber": order.order_number,
                "warehouse": order.warehouse,
                "grandTotal": order.grand_total,
                "checkoutLink": checkout_link,
                "payUrl": checkout_url(primary or order),
                "invoice": invoice_payload,
            }
        )

    return Response(
        {
            "ok": True,
            "groupId": group_id,
            "checkoutLink": checkout_link,
            "grandTotal": money(group_total),
            "orders": payload,
            "error": invoice_error,
        }
    )


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
    return Response(group_customer_order_payloads(OrderSerializer(qs, many=True).data))


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

    orders = (
        Order.objects.filter(user=request.user)
        .prefetch_related("items", "btc_invoices")
        .order_by("-created_at")[:24]
    )
    application = (
        AffiliateApplication.objects.filter(user=request.user).order_by("-created_at").first()
    )
    return Response(
        {
            "orders": group_customer_order_payloads(OrderSerializer(orders, many=True).data)[:8],
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
    statuses = statuses_for_tab(status)
    if statuses:
        qs = qs.filter(status__in=statuses)
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
    counts = tab_counts(base)
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
    status = canonical_status(request.data.get("status"))
    if not status:
        return Response({"error": "Invalid status."}, status=400)
    previous = order.status
    order.status = status
    stamp_if_completed(order)
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

    OPEN = list(OPEN_STATUSES)

    user_count_qs = User.objects.all()
    if request.user.role != User.Role.SUPERUSER:
        user_count_qs = user_count_qs.exclude(role=User.Role.SUPERUSER)
    warehouse = managed_warehouse(request.user) or parse_accounting_warehouse(
        request.GET.get("warehouse")
    )
    scoped = warehouse in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2)
    orders_qs = Order.objects.all()
    open_qs = Order.objects.filter(status__in=OPEN)
    revenue_qs = Order.objects.filter(status__in=REVENUE_ELIGIBLE)
    if scoped:
        orders_qs = orders_qs.filter(warehouse=warehouse)
        open_qs = open_qs.filter(warehouse=warehouse)
        revenue_qs = revenue_qs.filter(warehouse=warehouse)
    else:
        warehouse = "BOTH"

    now = timezone.now()
    today_start, week_start, week_end, month_start = dashboard_week_bounds(now)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    reset = AccountingReset.objects.order_by("-reset_at").first()
    reset_at = reset.reset_at if reset else None
    dash_reset_raw = get_json("dashboard.shipping_reset_at", None)
    dash_reset_at = parse_datetime(dash_reset_raw) if isinstance(dash_reset_raw, str) else None
    if dash_reset_at and timezone.is_naive(dash_reset_at):
        dash_reset_at = timezone.make_aware(dash_reset_at, timezone.get_current_timezone())
    if dash_reset_at and (reset_at is None or dash_reset_at > reset_at):
        reset_at = dash_reset_at
    shipping_reset_qs = revenue_qs
    if reset_at:
        shipping_reset_qs = revenue_qs.filter(created_at__gte=reset_at)
    week_since = week_start
    if reset_at and reset_at > week_start:
        week_since = reset_at

    low_stock, out_of_stock = catalog_stock_counts(warehouse)

    month_items = OrderItem.objects.filter(
        order__status__in=REVENUE_ELIGIBLE,
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
    top_rev = (
        month_items.values("product__categories__name")
        .annotate(revenue=Sum("line_total"))
        .order_by("-revenue")
        .first()
    )
    top_rev_name = (top_rev or {}).get("product__categories__name") or top_name
    top_rev_amount = (top_rev or {}).get("revenue") or 0

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
                warehouse=code, status__in=PROCESSING_LIKE
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
    payload = {
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
            "outOfStockCount": out_of_stock,
            "pendingAffiliates": AffiliateApplication.objects.filter(status="pending").count(),
            "userCount": user_count_qs.count(),
            "warehouse": warehouse,
            "period": dashboard_period_labels(now),
            "salesToday": revenue_qs.filter(created_at__gte=today_start).aggregate(
                total=Sum("grand_total")
            )["total"]
            or 0,
            "salesThisWeek": revenue_qs.filter(created_at__gte=week_start).aggregate(
                total=Sum("grand_total")
            )["total"]
            or 0,
            "salesThisMonth": revenue_qs.filter(created_at__gte=month_start).aggregate(
                total=Sum("grand_total")
            )["total"]
            or 0,
            "salesThisYear": revenue_qs.filter(created_at__gte=year_start).aggregate(
                total=Sum("grand_total")
            )["total"]
            or 0,
            "shippingSinceReset": shipping_reset_qs.aggregate(total=Sum("shipping_total"))["total"]
            or 0,
            "shippingThisWeek": revenue_qs.filter(created_at__gte=week_since).aggregate(
                total=Sum("shipping_total")
            )["total"]
            or 0,
            "ordersPending": orders_qs.filter(status=Order.Status.PENDING).count(),
            "ordersFailed": orders_qs.filter(status=Order.Status.FAILED).count(),
            "ordersProcessing": orders_qs.filter(status__in=PROCESSING_LIKE).count(),
            "ordersCompleted": orders_qs.filter(
                completed_this_week_q(week_start, week_end)
            ).count(),
            "ordersOnHold": orders_qs.filter(status=Order.Status.ON_HOLD).count(),
            "ordersCancelled": orders_qs.filter(status=Order.Status.CANCELLED).count(),
            "ordersRefunded": orders_qs.filter(status=Order.Status.REFUNDED).count(),
            "ordersPartiallyFilled": orders_qs.filter(status=Order.Status.PARTIALLY_FILLED).count(),
            "topCategoryMonth": {"name": top_name, "count": top_count},
            "topCategoryMonthRevenue": top_rev_amount,
            "topCategoryMonthName": top_rev_name,
            "categoriesTotal": Category.objects.count(),
            "warehousesTotal": 2,
            "couponsTotal": Coupon.objects.count(),
            "giftCardsTotal": 0,
            "customersTotal": User.objects.filter(role=User.Role.CUSTOMER).count(),
            "customersThisMonth": User.objects.filter(
                role=User.Role.CUSTOMER, created_at__gte=month_start
            ).count(),
            "productsActive": Product.objects.filter(status="publish").count(),
            "storeCreditAvailable": 0,
            "warehouses": warehouses,
            "orders": OrderSerializer(orders, many=True).data,
        }
    payload["dashboardTiles"] = resolve_tiles(payload)
    return Response(payload)


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
    status = canonical_status(request.data.get("status"))
    ids = request.data.get("ids") or []
    if not status:
        return Response({"error": "Invalid status."}, status=400)
    warehouse = managed_warehouse(request.user)
    qs = Order.objects.filter(pk__in=ids)
    if warehouse:
        qs = qs.filter(warehouse=warehouse)
    updated = 0
    for order in qs:
        previous = order.status
        order.status = status
        stamp_if_completed(order)
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
    if tracking:
        order.status = Order.Status.COMPLETED
        stamp_if_completed(order)
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


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_order_customers_search(request):
    from orders.admin_create import search_customers

    return Response(search_customers(request.GET.get("q") or request.GET.get("query") or "", request.GET.get("limit")))


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_order_customer_lookup(request):
    from orders.admin_create import lookup_customer

    row = lookup_customer(request.GET.get("q") or request.GET.get("username") or request.GET.get("email") or "")
    if not row:
        return Response({"error": "Customer not found."}, status=404)
    return Response(row)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_order_preview(request):
    from orders.admin_create import AdminCreateError, preview

    try:
        return Response(preview(request.data if isinstance(request.data, dict) else {}))
    except AdminCreateError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_order_create(request):
    from orders.admin_create import AdminCreateError, create

    try:
        return Response(create(request.data if isinstance(request.data, dict) else {}, request.user), status=201)
    except AdminCreateError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_order_summary(request):
    from orders.summary import build_summary

    return Response(build_summary(request))


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_order_summary_pdf(request):
    from orders.summary import build_summary, summary_pdf_bytes

    payload = build_summary(request)
    response = HttpResponse(summary_pdf_bytes(payload), content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="order-summary.pdf"'
    return response
