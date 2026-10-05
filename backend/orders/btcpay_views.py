from __future__ import annotations

import json
import logging

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsAuthenticatedUser, IsStoreStaff
from orders.btcpay import (
    BtcPayError,
    admin_payload,
    checkout_window_closed,
    create_invoice,
    handle_webhook,
    save_admin_settings,
    serialize_invoice,
    setup_webhook,
    test_connection,
    update_invoice_status,
)
from orders.fulfillment import group_grand_total, payment_primary
from orders.models import BtcInvoice, Order
from orders.pay_token import checkout_url, order_may_pay, verify_and_load

logger = logging.getLogger(__name__)


def invoice_for_order(order: Order) -> BtcInvoice | None:
    invoice = order.btc_invoices.order_by("-created_at").first()
    if invoice:
        return invoice
    primary = payment_primary(order)
    if primary.id != order.id:
        return primary.btc_invoices.order_by("-created_at").first()
    return None


def can_access_order(request, order: Order) -> bool:
    user = request.user
    if not user or not user.is_authenticated:
        return False
    if order.user_id and str(order.user_id) == str(user.id):
        return True
    return bool(user.email and user.email.lower() == (order.customer_email or "").lower())


def invoice_error(exc: BtcPayError, fallback_status: int = 400) -> Response:
    status = exc.status if exc.status and 400 <= exc.status < 600 else fallback_status
    if status == 401:
        return Response({"error": str(exc)}, status=401)
    return Response({"error": str(exc)}, status=status if status >= 400 else fallback_status)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def btc_webhook_view(request):
    raw = request.body or b""
    payload = request.data
    if not payload and raw:
        try:
            payload = json.loads(raw.decode())
        except Exception:
            payload = {}
    if not isinstance(payload, dict):
        payload = {}
    signature = request.headers.get("BTCPay-Sig") or request.headers.get("btcpay-sig")
    try:
        handle_webhook(payload, signature, raw)
    except BtcPayError as exc:
        if "signature" in str(exc).lower():
            return Response({"error": "Unauthorized"}, status=401)
        logger.exception("BTCPay webhook failed")
        return Response({"ok": False, "error": str(exc)})
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def pay_token_info_view(request):
    token = str(request.GET.get("t") or request.query_params.get("t") or "")
    order = verify_and_load(token)
    if not order:
        return Response({"error": "Invalid payment link"}, status=404)
    invoice = invoice_for_order(order)
    primary = payment_primary(order)
    return Response(
        {
            "orderId": str(primary.id),
            "orderNumber": primary.group_id or primary.order_number,
            "paymentMethod": order.payment_method,
            "paymentStatus": order.payment_status,
            "orderStatus": order.status,
            "grandTotal": group_grand_total(order),
            "canPay": order_may_pay(order),
            "checkoutWindowClosed": checkout_window_closed(order),
            "payUrl": checkout_url(order),
            "invoice": serialize_invoice(invoice),
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def pay_token_invoice_view(request):
    token = str(
        request.data.get("t")
        or request.GET.get("t")
        or request.query_params.get("t")
        or ""
    )
    order = verify_and_load(token)
    if not order:
        return Response({"error": "Invalid payment link"}, status=404)
    if not order_may_pay(order):
        invoice = invoice_for_order(order)
        return Response(
            {
                "error": "This order cannot be paid with this link.",
                "invoice": serialize_invoice(invoice),
                "canPay": False,
            },
            status=422,
        )
    try:
        existing = invoice_for_order(order)
        if existing and existing.checkout_link() and not existing.is_checkout_closed():
            try:
                update_invoice_status(existing)
                existing.refresh_from_db()
            except BtcPayError:
                pass
            if existing.checkout_link():
                return Response(serialize_invoice(existing))
        invoice = create_invoice(order)
    except BtcPayError as exc:
        return invoice_error(exc, 422)
    return Response(serialize_invoice(invoice))


@api_view(["POST"])
@permission_classes([IsAuthenticatedUser])
def create_order_invoice_view(request, pk):
    order = Order.objects.filter(pk=pk).first()
    if not order or not can_access_order(request, order):
        return Response({"error": "Not found."}, status=404)
    if not order_may_pay(order):
        return Response({"error": "This order is not awaiting Bitcoin payment."}, status=422)
    try:
        invoice = create_invoice(order)
    except BtcPayError as exc:
        return invoice_error(exc, 422)
    return Response(serialize_invoice(invoice))


@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
def order_invoice_view(request, pk):
    order = Order.objects.filter(pk=pk).first()
    if not order or not can_access_order(request, order):
        return Response({"error": "Not found."}, status=404)
    invoice = invoice_for_order(order)
    if not invoice:
        return Response({"error": "No invoice found for this order."}, status=404)
    try:
        update_invoice_status(invoice)
        invoice.refresh_from_db()
    except BtcPayError:
        logger.warning("Could not refresh BTCPay invoice %s", invoice.invoice_id)
    return Response(serialize_invoice(invoice))


@api_view(["GET"])
@permission_classes([AllowAny])
def invoice_status_view(request, invoice_id):
    invoice = BtcInvoice.objects.select_related("order").filter(invoice_id=invoice_id).first()
    if not invoice:
        return Response({"error": "Not found."}, status=404)
    order = invoice.order
    token = str(request.GET.get("t") or "")
    allowed = can_access_order(request, order)
    if not allowed and token:
        token_order = verify_and_load(token)
        allowed = bool(
            token_order
            and token_order.group_id
            and order.group_id
            and token_order.group_id == order.group_id
        )
    if not allowed:
        return Response({"error": "Not found."}, status=404)
    try:
        update_invoice_status(invoice)
        invoice.refresh_from_db()
    except BtcPayError as exc:
        return invoice_error(exc, 502)
    return Response(serialize_invoice(invoice))


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_btcpay_settings_view(request):
    if request.method == "PUT":
        try:
            return Response(save_admin_settings(request.data if isinstance(request.data, dict) else {}))
        except BtcPayError as exc:
            return invoice_error(exc, 422)
    return Response(admin_payload())


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_btcpay_test_view(request):
    try:
        return Response(test_connection())
    except BtcPayError as exc:
        return invoice_error(exc, 400)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_btcpay_webhook_view(request):
    try:
        return Response(setup_webhook())
    except BtcPayError as exc:
        return invoice_error(exc, 400)

