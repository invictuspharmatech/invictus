from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from orders.models import Order


def email_hash(order: Order) -> str:
    email = (order.customer_email or "").strip().lower()
    return hashlib.sha256(f"{email}|{order.id}".encode()).hexdigest()


def signing_key() -> bytes:
    return (settings.AUTH_SECRET or settings.SECRET_KEY).encode()


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64decode(value: str) -> bytes | None:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except Exception:
        return None


def encode(order: Order) -> str:
    payload = json.dumps({"oid": str(order.id), "eh": email_hash(order)}, separators=(",", ":"))
    sig = hmac.new(signing_key(), payload.encode(), hashlib.sha256).digest()
    return f"{_b64encode(payload.encode())}.{_b64encode(sig)}"


def checkout_url(order: Order) -> str:
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    return f"{base}/orders/pay?t={encode(order)}"


def order_may_pay(order: Order) -> bool:
    if (order.payment_method or "").lower() != "btc":
        return False
    if order.payment_status not in (Order.PaymentStatus.PENDING, Order.PaymentStatus.PARTIAL):
        return False
    if order.status in (
        Order.Status.CANCELLED,
        Order.Status.FAILED,
        Order.Status.COMPLETED,
        Order.Status.REFUNDED,
        Order.Status.PARTIALLY_FILLED,
        Order.Status.DELIVERED,
        Order.Status.SHIPPED,
    ):
        return False
    if order.created_at and order.created_at <= timezone.now() - timedelta(hours=24):
        return False
    return True


def verify_and_load(token: str) -> Order | None:
    token = (token or "").strip()
    if "." not in token:
        return None
    payload_b64, sig_b64 = token.split(".", 1)
    payload = _b64decode(payload_b64)
    sig = _b64decode(sig_b64)
    if payload is None or sig is None:
        return None
    expected = hmac.new(signing_key(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        data = json.loads(payload.decode())
    except Exception:
        return None
    oid = str(data.get("oid") or "")
    eh = str(data.get("eh") or "")
    if not oid or not eh:
        return None
    order = Order.objects.filter(pk=oid).first()
    if not order or (order.payment_method or "").lower() != "btc":
        return None
    if eh != email_hash(order):
        return None
    return order
