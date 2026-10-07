from __future__ import annotations

from collections import defaultdict

from django.db import transaction
from django.db.models import Q

from accounts.models import User
from catalog.models import Product
from orders.btcpay import BtcPayError, create_invoice, is_configured, serialize_invoice
from orders.coupons import bump_usage, discount_for, is_free_shipping, resolve_coupon
from orders.fulfillment import FulfillmentError, allocate_quantity, apply_group_shipping, decrement_allocations, get_warehouse_settings
from orders.models import Order, OrderItem
from orders.order_numbers import allocate_group_id, warehouse_order_suffix
from orders.pay_token import checkout_url
from orders.serializers import OrderSerializer
from orders.shop_config import get_default_shipping_usd
from orders.status import canonical_status
from orders.totals import allocate_weighted, customer_checkout_totals, money
from cms.mailer import send_order_event
from django.utils import timezone


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


class AdminCreateError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _text(data: dict, *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def _float(value, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def lookup_customer(query: str) -> dict | None:
    cleaned = (query or "").strip()
    if not cleaned:
        return None
    user = (
        User.objects.filter(email__iexact=cleaned).first()
        or User.objects.filter(name__iexact=cleaned).first()
        or User.objects.filter(email__icontains=cleaned).first()
        or User.objects.filter(name__icontains=cleaned).first()
    )
    if not user:
        return None
    last = Order.objects.filter(user=user).order_by("-created_at").first()
    shipping = {
        "name": (last.customer_name if last else "") or user.name,
        "email": user.email,
        "line1": last.shipping_line1 if last else "",
        "line2": last.shipping_line2 if last else "",
        "city": last.shipping_city if last else "",
        "state": last.shipping_state if last else "",
        "postal": last.shipping_postal if last else "",
        "country": last.shipping_country if last else "US",
    }
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "shipping": shipping,
    }


def search_customers(query: str, limit: int = 12) -> list[dict]:
    cleaned = (query or "").strip()
    if len(cleaned) < 2:
        return []
    try:
        cap = max(1, min(int(limit or 12), 25))
    except (TypeError, ValueError):
        cap = 12
    rows = User.objects.filter(role=User.Role.CUSTOMER).filter(models_q(cleaned))[:cap]
    return [
        {"id": str(row.id), "name": row.name, "email": row.email}
        for row in rows
    ]


def models_q(cleaned: str):
    return Q(email__icontains=cleaned) | Q(name__icontains=cleaned)


def _plan(data: dict) -> dict:
    items = data.get("items") or []
    if not items:
        raise AdminCreateError("Add at least one product.")
    required = ["name", "email", "line1", "city", "state", "postal"]
    shipping = data.get("shipping") if isinstance(data.get("shipping"), dict) else data
    missing = [field for field in required if not _text(shipping, field)]
    if missing:
        raise AdminCreateError("Shipping details are required.")

    product_ids = [item.get("productId") or item.get("product_id") for item in items]
    products = {str(row.id): row for row in Product.objects.filter(id__in=product_ids)}
    policy = get_warehouse_settings()
    lines = []
    stock_ops = []
    try:
        for item in items:
            product = products.get(str(item.get("productId") or item.get("product_id") or ""))
            if not product:
                raise AdminCreateError("One or more products are unavailable.")
            quantity = max(1, int(item.get("quantity") or 1))
            override = item.get("unitPrice")
            if override in (None, ""):
                override = item.get("unit_price")
            unit_price = money(override) if override not in (None, "") else money(product_price(product))
            for warehouse, qty in allocate_quantity(product, quantity, policy):
                lines.append(
                    {
                        "product": product,
                        "quantity": qty,
                        "unit_price": unit_price,
                        "line_total": money(unit_price * qty),
                        "warehouse": warehouse,
                    }
                )
                stock_ops.append((product, warehouse, qty))
    except FulfillmentError as exc:
        raise AdminCreateError(str(exc)) from exc

    merchandise_total = money(sum(line["line_total"] for line in lines))
    coupon = None
    coupon_code = _text(data, "couponCode", "coupon_code")
    if coupon_code:
        coupon, coupon_error = resolve_coupon(coupon_code, merchandise_total)
        if coupon_error:
            raise AdminCreateError(coupon_error)

    waive = bool(data.get("waiveShipping") or data.get("waive_shipping"))
    shipping_override = data.get("shippingAmount")
    if shipping_override in (None, ""):
        shipping_override = data.get("shipping_amount")
    coupon_discount = discount_for(coupon, merchandise_total) if coupon else 0.0
    if waive or is_free_shipping(coupon):
        shipping_usd = 0.0
        free_shipping = True
    elif shipping_override not in (None, ""):
        shipping_usd = max(0.0, _float(shipping_override))
        free_shipping = shipping_usd == 0
    else:
        shipping_usd = get_default_shipping_usd()
        free_shipping = False
    totals = customer_checkout_totals(
        merchandise_total,
        coupon_discount=coupon_discount,
        free_shipping=free_shipping,
        shipping_usd=shipping_usd,
    )
    user_id = data.get("userId") or data.get("user_id")
    user = User.objects.filter(pk=user_id).first() if user_id else None
    return {
        "lines": lines,
        "stock_ops": stock_ops,
        "coupon": coupon,
        "totals": totals,
        "user": user,
        "shipping": shipping,
        "waive": waive or bool(totals["shipping_waived"]),
    }


def preview(data: dict) -> dict:
    plan = _plan(data)
    totals = plan["totals"]
    return {
        "merchandiseTotal": totals["merchandise"],
        "shippingTotal": totals["shipping"],
        "discountTotal": totals["discount_total"],
        "grandTotal": totals["grand_total"],
        "couponCode": plan["coupon"].code if plan["coupon"] else "",
        "itemCount": sum(line["quantity"] for line in plan["lines"]),
        "warehouses": sorted({line["warehouse"] for line in plan["lines"]}),
    }


def create(data: dict, actor: User | None = None) -> dict:
    send_mail = bool(data.get("sendConfirmationEmail") if "sendConfirmationEmail" in data else data.get("send_confirmation_email", True))
    payment_method = (_text(data, "paymentMethod", "payment_method") or "btc").lower()
    if payment_method not in ("btc", "manual"):
        payment_method = "btc"
    status = canonical_status(data.get("status")) or Order.Status.PENDING
    payment_status = str(data.get("paymentStatus") or data.get("payment_status") or Order.PaymentStatus.PENDING).upper()
    if payment_status not in {choice[0] for choice in Order.PaymentStatus.choices}:
        payment_status = Order.PaymentStatus.PENDING
    if status in (Order.Status.PROCESSING, Order.Status.COMPLETED, Order.Status.PARTIALLY_FILLED):
        payment_status = Order.PaymentStatus.PAID
    notes = _text(data, "adminNote", "admin_note", "notes", "customerNote", "customer_note")

    with transaction.atomic():
        plan = _plan(data)
        decrement_allocations(plan["stock_ops"])
        shipping = plan["shipping"]
        totals = plan["totals"]
        coupon = plan["coupon"]
        grouped = defaultdict(list)
        for line in plan["lines"]:
            grouped[line["warehouse"]].append(line)
        warehouse_groups = list(grouped.items())
        weights = [sum(line["line_total"] for line in group_lines) for _, group_lines in warehouse_groups]
        merch_shares = allocate_weighted(float(totals["merchandise"]), weights)
        discount_shares = allocate_weighted(float(totals["discount_total"]), weights)
        try:
            group_id = allocate_group_id()
        except ValueError as exc:
            raise AdminCreateError(str(exc)) from exc
        created = []
        email = _text(shipping, "email").lower()
        name = _text(shipping, "name")
        for index, (warehouse, group_lines) in enumerate(warehouse_groups):
            merch_after = merch_shares[index]
            suffix = warehouse_order_suffix(warehouse)
            paid_at = timezone.now() if payment_status == Order.PaymentStatus.PAID else None
            order = Order.objects.create(
                order_number=f"{group_id}-{suffix}",
                group_id=group_id,
                split_index=index + 1,
                warehouse=warehouse,
                user=plan["user"],
                status=status,
                payment_status=payment_status,
                payment_method=payment_method,
                merchandise_total=merch_after,
                shipping_total=0,
                grand_total=merch_after,
                customer_name=name,
                customer_email=email,
                shipping_line1=_text(shipping, "line1"),
                shipping_line2=_text(shipping, "line2"),
                shipping_city=_text(shipping, "city"),
                shipping_state=_text(shipping, "state"),
                shipping_postal=_text(shipping, "postal"),
                shipping_country=_text(shipping, "country") or "US",
                notes=notes,
                coupon=coupon,
                coupon_code=coupon.code if coupon else "",
                discount_total=discount_shares[index],
                shipping_waived=plan["waive"],
                paid_at=paid_at,
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

    created.sort(key=lambda row: (row.split_index, str(row.id)))
    primary = created[0] if created else None
    checkout_link = None
    invoice_payload = None
    invoice_error = None
    group_total = 0.0
    for order in created:
        order.refresh_from_db()
        group_total += float(order.grand_total)
    if primary and payment_method == "btc" and payment_status == Order.PaymentStatus.PENDING and group_total > 0.01:
        if not is_configured():
            invoice_error = "Bitcoin checkout is not configured."
        else:
            try:
                invoice = create_invoice(primary)
                invoice_payload = serialize_invoice(invoice)
                checkout_link = invoice_payload.get("checkoutLink") if invoice_payload else None
            except BtcPayError as exc:
                invoice_error = str(exc)
    if primary and send_mail:
        send_order_event("order_placed", primary)

    return {
        "ok": True,
        "groupId": created[0].group_id if created else "",
        "grandTotal": money(group_total),
        "checkoutLink": checkout_link,
        "invoice": invoice_payload,
        "error": invoice_error,
        "orders": OrderSerializer(created, many=True).data,
        "payUrl": checkout_url(primary) if primary else None,
        "createdBy": str(actor.id) if actor else None,
    }
