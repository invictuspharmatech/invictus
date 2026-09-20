from collections import defaultdict
from datetime import timedelta

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
from catalog.models import Product
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


COUNTED = [
    Order.Status.PAID,
    Order.Status.PROCESSING,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
]
SHIPPED = [Order.Status.SHIPPED, Order.Status.DELIVERED]

TILE_COPY = {
    "SHIPPING_COLLECTED": (
        "Shipping collected",
        "Shipping fees collected on paid orders.",
    ),
    "GROSS_25": ("25% of gross sales", "25% of merchandise totals, excluding shipping."),
    "WAREHOUSE1_75": (
        "Warehouse 1 · 75%",
        "75% of merchandise shipped from warehouse 1, excluding shipping.",
    ),
    "WAREHOUSE2_55": (
        "Warehouse 2 · 55%",
        "55% of merchandise shipped from warehouse 2, excluding shipping.",
    ),
    "WAREHOUSE2_20": (
        "Warehouse 2 · 20%",
        "20% of merchandise shipped from warehouse 2, excluding shipping.",
    ),
}


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
                status=Order.Status.PAID,
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
                paid_at=timezone.now(),
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
        for order in created:
            order.refresh_from_db()
            send_order_event("order_placed", order)
            payload.append({"orderNumber": order.order_number, "warehouse": order.warehouse})

    return Response({"ok": True, "groupId": group_id, "orders": payload})


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
    qs = qs.prefetch_related("items").distinct()
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
    qs = Order.objects.prefetch_related("items").all()
    warehouse = managed_warehouse(request.user)
    if warehouse:
        qs = qs.filter(warehouse=warehouse)
    return Response(OrderSerializer(qs[:200], many=True).data)


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
    from catalog.models import Product

    user_count_qs = User.objects.all()
    if request.user.role != User.Role.SUPERUSER:
        user_count_qs = user_count_qs.exclude(role=User.Role.SUPERUSER)
    orders_qs = Order.objects.all()
    open_qs = Order.objects.filter(status__in=[Order.Status.PAID, Order.Status.PROCESSING])
    warehouse = managed_warehouse(request.user) or parse_accounting_warehouse(
        request.GET.get("warehouse")
    )
    if warehouse in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
        orders_qs = orders_qs.filter(warehouse=warehouse)
        open_qs = open_qs.filter(warehouse=warehouse)
    else:
        warehouse = "BOTH"
    open_total = open_qs.aggregate(total=Sum("grand_total"))["total"] or 0
    orders = orders_qs[:8]
    return Response(
        {
            "productCount": Product.objects.count(),
            "openOrderValue": open_total,
            "pendingAffiliates": AffiliateApplication.objects.filter(status="pending").count(),
            "userCount": user_count_qs.count(),
            "warehouse": warehouse,
            "orders": OrderSerializer(orders, many=True).data,
        }
    )


def period_window(period: str, now=None):
    now = now or timezone.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "WEEK":
        start = start - timedelta(days=start.weekday())
    elif period == "MONTH":
        start = start.replace(day=1)
    return start


def later(a, b):
    return a if a > b else b


def parse_accounting_warehouse(value: str | None) -> str:
    if value in ("WAREHOUSE_1", "WAREHOUSE_2", "BOTH"):
        return value
    return "BOTH"


def tiles_for_warehouse(warehouse: str) -> list[str]:
    if warehouse == Order.Warehouse.WAREHOUSE_1:
        return ["SHIPPING_COLLECTED", "GROSS_25", "WAREHOUSE1_75"]
    if warehouse == Order.Warehouse.WAREHOUSE_2:
        return ["SHIPPING_COLLECTED", "GROSS_25", "WAREHOUSE2_55", "WAREHOUSE2_20"]
    return list(TILE_COPY.keys())


def scoped_orders(qs, warehouse: str):
    if warehouse in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
        return qs.filter(warehouse=warehouse)
    return qs


def compute_tile(key: str, start, warehouse: str):
    counted = scoped_orders(
        Order.objects.filter(status__in=COUNTED, created_at__gte=start),
        warehouse,
    )
    shipped = scoped_orders(
        Order.objects.filter(status__in=SHIPPED, shipped_at__gte=start),
        warehouse,
    )
    if key == "SHIPPING_COLLECTED":
        return counted.aggregate(total=Sum("shipping_total"))["total"] or 0
    if key == "GROSS_25":
        total = counted.aggregate(total=Sum("merchandise_total"))["total"] or 0
        return total * 0.25
    if key == "WAREHOUSE1_75":
        total = shipped.filter(warehouse=Order.Warehouse.WAREHOUSE_1).aggregate(
            total=Sum("merchandise_total")
        )["total"] or 0
        return total * 0.75
    if key == "WAREHOUSE2_55":
        total = shipped.filter(warehouse=Order.Warehouse.WAREHOUSE_2).aggregate(
            total=Sum("merchandise_total")
        )["total"] or 0
        return total * 0.55
    if key == "WAREHOUSE2_20":
        total = shipped.filter(warehouse=Order.Warehouse.WAREHOUSE_2).aggregate(
            total=Sum("merchandise_total")
        )["total"] or 0
        return total * 0.2
    return 0


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_accounting_view(request):
    period = request.GET.get("period") or "DAY"
    if period not in ("DAY", "WEEK", "MONTH"):
        period = "DAY"
    warehouse = parse_accounting_warehouse(request.GET.get("warehouse"))
    window_start = period_window(period)
    resets = {
        row.tile_key: row
        for row in AccountingReset.objects.filter(period=period, warehouse=warehouse)
    }
    tiles = []
    for key in tiles_for_warehouse(warehouse):
        title, description = TILE_COPY[key]
        reset = resets.get(key)
        start = later(window_start, reset.reset_at) if reset else window_start
        tiles.append(
            {
                "key": key,
                "title": title,
                "description": description,
                "amount": compute_tile(key, start, warehouse),
                "resetAt": reset.reset_at.isoformat() if reset else None,
            }
        )
    return Response({"period": period, "warehouse": warehouse, "tiles": tiles})


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_accounting_reset_view(request):
    tile_key = request.data.get("tileKey")
    period = request.data.get("period")
    warehouse = parse_accounting_warehouse(request.data.get("warehouse"))
    if tile_key not in TILE_COPY or period not in ("DAY", "WEEK", "MONTH"):
        return Response({"error": "Invalid tile or period."}, status=400)
    if tile_key not in tiles_for_warehouse(warehouse):
        return Response({"error": "Tile is not available for this warehouse filter."}, status=400)
    AccountingReset.objects.update_or_create(
        tile_key=tile_key,
        period=period,
        warehouse=warehouse,
        defaults={"reset_at": timezone.now(), "reset_by_id": str(request.user.id)},
    )
    return Response({"ok": True})
