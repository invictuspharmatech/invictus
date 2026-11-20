from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import secrets
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from cms.models import SiteSetting
from orders.status import LOCKED_STATUSES
from orders.fulfillment import (
    apply_group_shipping,
    group_grand_total,
    live_group_orders,
    payment_primary,
    restock_order,
)
from orders.models import BtcInvoice, Order

logger = logging.getLogger(__name__)

SETTING_KEYS = {
    "server_url": "btcpay.server_url",
    "api_key": "btcpay.api_key",
    "store_id": "btcpay.store_id",
    "webhook_secret": "btcpay.webhook_secret",
    "webhook_id": "btcpay.webhook_id",
    "webhook_url": "btcpay.webhook_url",
    "invoice_expiration_minutes": "btcpay.invoice_expiration_minutes",
    "default_customer_message": "btcpay.default_customer_message",
    "authorize_state": "btcpay.authorize_state",
    "authorize_server_url": "btcpay.authorize_server_url",
    "authorize_profile": "btcpay.authorize_profile",
}

# Optional failover BTCPay — never overwrites primary keys above.
SECONDARY_SETTING_KEYS = {
    "server_url": "btcpay.secondary.server_url",
    "api_key": "btcpay.secondary.api_key",
    "store_id": "btcpay.secondary.store_id",
    "webhook_secret": "btcpay.secondary.webhook_secret",
    "webhook_id": "btcpay.secondary.webhook_id",
    "webhook_url": "btcpay.secondary.webhook_url",
    "enabled": "btcpay.secondary.enabled",
}

PROFILES = ("primary", "secondary")
INVOICE_META_KEY = "_invictusBtcPay"

# Same set GreatLife/WooCommerce requests via /api-keys/authorize (webhook included).
AUTHORIZE_PERMISSIONS = [
    "btcpay.store.canviewinvoices",
    "btcpay.store.cancreateinvoice",
    "btcpay.store.canviewstoresettings",
    "btcpay.store.canmodifyinvoices",
    "btcpay.store.webhooks.canmodifywebhooks",
    "btcpay.store.cancreatenonapprovedpullpayments",
]

REQUIRED_AUTHORIZE_PERMISSIONS = [
    "btcpay.store.canviewinvoices",
    "btcpay.store.cancreateinvoice",
    "btcpay.store.canviewstoresettings",
    "btcpay.store.canmodifyinvoices",
    "btcpay.store.webhooks.canmodifywebhooks",
]

WEBHOOK_EVENTS = [
    "InvoiceReceivedPayment",
    "InvoicePaymentSettled",
    "InvoiceProcessing",
    "InvoiceExpired",
    "InvoiceSettled",
    "InvoiceComplete",
    "InvoiceInvalid",
]


class BtcPayError(Exception):
    def __init__(self, message: str, status: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status = status
        self.payload = payload


def setting_get(key: str, default: str = "") -> str:
    row = SiteSetting.objects.filter(pk=key).first()
    if not row or row.value is None or row.value == "":
        return default
    return row.value


def setting_set(key: str, value: str, label: str = "", group: str = "btcpay") -> None:
    SiteSetting.objects.update_or_create(
        key=key,
        defaults={"value": value or "", "label": label, "group": group},
    )


def mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 4:
        return "***"
    return "***" + value[-4:]


def clean_server_url(value: str) -> str:
    url = (value or "").strip()
    url = re.sub(r"/stores/.*$", "", url)
    url = re.sub(r"/webhooks/.*$", "", url)
    return url.rstrip("/")


def clean_api_key(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip())


def webhook_public_url() -> str:
    return settings.PUBLIC_SITE_URL.rstrip("/") + "/api/btc/webhook"


def normalize_profile(profile: str | None) -> str:
    value = (profile or "primary").strip().lower()
    return value if value in PROFILES else "primary"


def _keys_for_profile(profile: str) -> dict[str, str]:
    return SECONDARY_SETTING_KEYS if normalize_profile(profile) == "secondary" else SETTING_KEYS


def get_config(profile: str | None = "primary") -> dict[str, str]:
    """Return connection for primary or secondary. Primary keys are never read from secondary."""
    code = normalize_profile(profile)
    keys = _keys_for_profile(code)
    server_url = clean_server_url(setting_get(keys["server_url"]))
    api_key = clean_api_key(setting_get(keys["api_key"]))
    store_id = setting_get(keys["store_id"]).strip()
    enabled = True
    if code == "secondary":
        enabled = setting_get(SECONDARY_SETTING_KEYS["enabled"], "1").strip().lower() not in (
            "0",
            "false",
            "off",
            "no",
        )
    return {
        "profile": code,
        "server_url": server_url,
        "api_key": api_key,
        "store_id": store_id,
        "enabled": "1" if enabled else "0",
    }


def is_configured(profile: str | None = "primary") -> bool:
    cfg = get_config(profile)
    if normalize_profile(profile) == "secondary" and cfg["enabled"] != "1":
        return False
    return bool(cfg["server_url"] and cfg["api_key"] and cfg["store_id"])


def secondary_enabled() -> bool:
    return is_configured("secondary")


def runtime_configs() -> list[dict[str, str]]:
    """Primary first, then secondary failover if configured. Order is intentional."""
    configs: list[dict[str, str]] = []
    if is_configured("primary"):
        configs.append(get_config("primary"))
    if secondary_enabled():
        configs.append(get_config("secondary"))
    return configs


def _attach_invoice_meta(data: dict, cfg: dict[str, str]) -> dict:
    payload = dict(data) if isinstance(data, dict) else {}
    payload[INVOICE_META_KEY] = {
        "profile": cfg.get("profile") or "primary",
        "serverUrl": cfg.get("server_url") or "",
        "storeId": cfg.get("store_id") or "",
    }
    return payload


def config_for_invoice(invoice: BtcInvoice | None) -> dict[str, str]:
    """Prefer the BTCPay profile that created the invoice; fall back to primary."""
    if invoice is not None:
        raw = invoice.btc_pay_response if isinstance(invoice.btc_pay_response, dict) else {}
        meta = raw.get(INVOICE_META_KEY) if isinstance(raw, dict) else None
        if isinstance(meta, dict):
            profile = normalize_profile(str(meta.get("profile") or ""))
            cfg = get_config(profile)
            if cfg["server_url"] and cfg["api_key"] and cfg["store_id"]:
                return cfg
            stored_url = clean_server_url(str(meta.get("serverUrl") or ""))
            stored_store = str(meta.get("storeId") or invoice.store_id or "").strip()
            if stored_url and cfg["api_key"] and stored_store:
                return {
                    "profile": profile,
                    "server_url": stored_url,
                    "api_key": cfg["api_key"],
                    "store_id": stored_store,
                    "enabled": "1",
                }
        # Match by store id if meta missing (older invoices).
        store = (invoice.store_id or "").strip()
        if store:
            for cfg in runtime_configs():
                if cfg["store_id"] == store:
                    return cfg
    return get_config("primary")


def _is_unreachable_failure(status: int | None, data: Any, exc: Exception | None = None) -> bool:
    """Failover only when the primary host is down/blocked — not on bad keys or validation."""
    if exc is not None:
        return True
    if status is None:
        return True
    if status in (502, 503, 504, 520, 521, 522, 523, 524):
        return True
    if isinstance(data, dict):
        if data.get("cloudflareBlocked") or data.get("cloudflare_error") or data.get("error_code") == 1010:
            return True
        title = str(data.get("title") or "")
        if "Error 1010" in title or "cloudflare" in title.lower():
            return True
    return False


def invoice_expiration_minutes() -> int:
    raw = setting_get(SETTING_KEYS["invoice_expiration_minutes"], "480")
    try:
        minutes = int(raw)
    except ValueError:
        minutes = 480
    return max(5, min(10080, minutes))


def checkout_window_closed(order: Order) -> bool:
    if not order.created_at:
        return False
    return order.created_at <= timezone.now() - timedelta(hours=24)


def _store_path(store_id: str, suffix: str = "") -> str:
    """Match GreatLife/Greenfield SDK: URL-encode store id in API paths."""
    encoded = urllib.parse.quote(str(store_id or "").strip(), safe="")
    return f"/api/v1/stores/{encoded}{suffix}"


def _normalize_webhook_rows(data: Any) -> list[dict]:
    """BTCPay may return a bare list or a wrapped object depending on version."""
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        for key in ("webhooks", "result", "data"):
            nested = data.get(key)
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    return []


def _request(method: str, path: str, payload: dict | None = None, config: dict | None = None) -> tuple[int, Any]:
    cfg = config or get_config()
    url = cfg["server_url"].rstrip("/") + path
    body = None if payload is None else json.dumps(payload).encode()
    headers = {
        # Greenfield / GreatLife: Authorization: token <apiKey>
        "Authorization": f"token {cfg['api_key']}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read()
            parsed = json.loads(raw.decode() or "{}") if raw else {}
            return resp.status, parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            parsed = json.loads(raw.decode() or "{}")
        except Exception:
            parsed = {"message": raw.decode(errors="replace")}
        return exc.code, parsed
    except urllib.error.URLError as exc:
        raise BtcPayError(f"Could not reach BTCPay Server: {exc.reason}") from exc


def extract_payment_details(invoice_data: dict) -> dict[str, Any]:
    payment_address = None
    crypto_code = None
    crypto_amount = None
    methods = invoice_data.get("paymentMethods") or invoice_data.get("PaymentMethods") or []

    def pick(require_activated: bool) -> bool:
        nonlocal payment_address, crypto_code, crypto_amount
        if not isinstance(methods, list):
            return False
        for method in methods:
            if not isinstance(method, dict):
                continue
            if require_activated and method.get("activated", True) is False:
                continue
            dest = method.get("destination") or method.get("Destination")
            if isinstance(dest, str) and dest.strip():
                payment_address = dest.strip()
                crypto_code = (
                    method.get("paymentMethodId")
                    or method.get("paymentMethod")
                    or method.get("cryptoCode")
                )
                crypto_amount = method.get("due") or method.get("amount") or method.get("rate")
                return True
        return False

    if not pick(True):
        pick(False)

    if not payment_address:
        for method in invoice_data.get("availablePaymentMethods") or []:
            if not isinstance(method, dict):
                continue
            dest = method.get("destination") or method.get("address")
            if isinstance(dest, str) and dest.strip():
                payment_address = dest.strip()
                crypto_code = method.get("paymentMethod") or method.get("cryptoCode")
                break
        for info in invoice_data.get("cryptoInfo") or []:
            if isinstance(info, dict) and isinstance(info.get("address"), str) and info["address"].strip():
                payment_address = info["address"].strip()
                crypto_code = info.get("cryptoCode")
                crypto_amount = info.get("cryptoAmount")
                break
        if not payment_address and isinstance(invoice_data.get("address"), str):
            payment_address = invoice_data["address"]

    return {
        "payment_address": payment_address or "",
        "crypto_code": crypto_code or "",
        "crypto_amount": "" if crypto_amount is None else str(crypto_amount),
    }


def map_status(btc_status: str) -> str:
    mapping = {
        "new": BtcInvoice.Status.NEW,
        "invalid": BtcInvoice.Status.INVALID,
        "processing": BtcInvoice.Status.CONFIRMED,
        "expired": BtcInvoice.Status.EXPIRED,
        "settled": BtcInvoice.Status.COMPLETE,
        "paid": BtcInvoice.Status.PAID,
        "complete": BtcInvoice.Status.COMPLETE,
    }
    return mapping.get((btc_status or "").strip().lower(), BtcInvoice.Status.NEW)


def indicates_paid_late(invoice_data: dict | None) -> bool:
    if not isinstance(invoice_data, dict):
        return False
    additional = invoice_data.get("additionalStatus")
    return isinstance(additional, str) and additional.strip().lower() == "paidlate"


def indicates_partial(invoice_data: dict | None) -> bool:
    if not isinstance(invoice_data, dict):
        return False
    additional = invoice_data.get("additionalStatus")
    if isinstance(additional, str) and additional.strip().lower() == "paidpartial":
        return True
    if (invoice_data.get("status") or "").strip().lower() != "expired":
        return False
    for method in invoice_data.get("paymentMethods") or []:
        if not isinstance(method, dict):
            continue
        for key in ("paymentMethodPaid", "totalPaid", "amountPaid"):
            try:
                if float(method.get(key) or 0) > 0:
                    return True
            except (TypeError, ValueError):
                continue
    return False


def webhook_flag(payload: dict, key: str) -> bool:
    truthy = (True, 1, "1", "true")
    if payload.get(key) in truthy:
        return True
    data = payload.get("data")
    if isinstance(data, dict) and data.get(key) in truthy:
        return True
    return False


def serialize_invoice(invoice: BtcInvoice | None) -> dict | None:
    if not invoice:
        return None
    closed = invoice.is_checkout_closed()
    return {
        "invoiceId": invoice.invoice_id,
        "status": invoice.status,
        "amount": invoice.amount,
        "currency": invoice.currency,
        "cryptoCode": invoice.crypto_code,
        "cryptoAmount": invoice.crypto_amount,
        "paymentAddress": invoice.payment_address,
        "expiresAt": invoice.expires_at.isoformat() if invoice.expires_at else None,
        "checkoutLink": None if closed else invoice.checkout_link(),
        "checkoutClosed": closed,
    }


def _parse_expiry(value: Any):
    if not value:
        return timezone.now() + timedelta(hours=1)
    if isinstance(value, (int, float)):
        from datetime import datetime, timezone as dt_timezone

        timestamp = float(value)
        if timestamp > 10_000_000_000:
            timestamp = timestamp / 1000
        return datetime.fromtimestamp(timestamp, tz=dt_timezone.utc)
    parsed = parse_datetime(str(value))
    if parsed:
        return parsed
    return timezone.now() + timedelta(hours=1)


def supersede_existing(order: Order) -> None:
    existing = list(order.btc_invoices.all())
    if not existing:
        return
    for invoice in existing:
        if (invoice.status or "").lower() in ("complete", "paid"):
            raise BtcPayError("This order already has a settled Bitcoin invoice.")
        cfg = config_for_invoice(invoice)
        try:
            _request(
                "POST",
                _store_path(cfg["store_id"], f"/invoices/{urllib.parse.quote(invoice.invoice_id, safe='')}/status"),
                {"status": "Invalid"},
                cfg,
            )
        except Exception:
            logger.warning("Could not mark BTCPay invoice invalid", extra={"invoice_id": invoice.invoice_id})
        invoice.delete()


def _invoice_create_failure_message(status: int, data: Any) -> str:
    message = ""
    if isinstance(data, dict):
        message = data.get("message") or data.get("error") or ""
        if data.get("missingPermission"):
            message = message or f"Missing permission {data['missingPermission']}."
    return message or "Failed to create BTCPay invoice."


def create_invoice(order: Order) -> BtcInvoice:
    if checkout_window_closed(order):
        raise BtcPayError("This Bitcoin payment link has expired. Place a new order to pay.")
    configs = runtime_configs()
    if not configs:
        raise BtcPayError("BTCPay Server is not connected. An admin must save the server URL, API key, and store ID.")
    if not order.order_number:
        raise BtcPayError("Order number is required to create a BTCPay invoice.")

    primary = payment_primary(order)
    amount = group_grand_total(primary)
    if amount <= 0:
        raise BtcPayError("This order has no amount due.")
    for sibling in live_group_orders(primary):
        supersede_existing(sibling)

    from orders.pay_token import checkout_url

    # Match GreatLife Greenfield createInvoice: amount + currency + metadata.orderId/buyerEmail + checkout.
    order_id = str(primary.order_number).strip()
    payload = {
        "amount": f"{amount:.2f}",
        "currency": "USD",
        "metadata": {
            "orderId": order_id,
            "buyerEmail": primary.customer_email or None,
            "itemDesc": f"Invictus Pharma {primary.group_id or order_id}",
            "groupId": primary.group_id or order_id,
        },
        "checkout": {
            "redirectURL": checkout_url(primary),
            "expirationMinutes": invoice_expiration_minutes(),
        },
    }

    # Failover policy: if primary cannot create an invoice for ANY reason
    # (network, Cloudflare 1010/403, permission-looking blocks, 4xx/5xx, timeouts),
    # try the next configured BTCPay. Only when every profile fails do shoppers
    # see the same error path as before.
    last_error: BtcPayError | None = None
    for index, cfg in enumerate(configs):
        profile = cfg.get("profile") or "primary"
        has_failover = index + 1 < len(configs)
        try:
            status, data = _request("POST", _store_path(cfg["store_id"], "/invoices"), payload, cfg)
        except BtcPayError as exc:
            last_error = exc
            if has_failover:
                logger.warning(
                    "BTCPay %s invoice create raised (%s); trying failover.",
                    profile,
                    exc,
                )
                continue
            raise

        if status < 400 and isinstance(data, dict) and data.get("id"):
            details = extract_payment_details(data)
            stored = _attach_invoice_meta(data, cfg)
            if index > 0:
                logger.info(
                    "BTCPay invoice created via failover profile=%s store=%s",
                    profile,
                    cfg.get("store_id"),
                )
            return BtcInvoice.objects.create(
                order=primary,
                invoice_id=data["id"],
                store_id=cfg["store_id"],
                amount=amount,
                currency="USD",
                crypto_code=details["crypto_code"],
                crypto_amount=details["crypto_amount"],
                payment_address=details["payment_address"],
                status=map_status(data.get("status") or "New"),
                expires_at=_parse_expiry(data.get("expirationTime")),
                btc_pay_response=stored,
            )

        message = _invoice_create_failure_message(status, data)
        last_error = BtcPayError(message, status, data)
        if has_failover:
            reason = "cloudflare/unreachable" if _is_unreachable_failure(status, data) else f"HTTP {status}"
            logger.warning(
                "BTCPay %s failed invoice create (%s: %s); trying failover.",
                profile,
                reason,
                message,
            )
            continue
        raise last_error

    # Both (or all) hosts failed → same end-user error path as before.
    if last_error is not None:
        raise last_error
    raise BtcPayError("Failed to create BTCPay invoice.")

def fetch_invoice(invoice_id: str, *, invoice: BtcInvoice | None = None) -> dict:
    cfg = config_for_invoice(invoice) if invoice is not None else get_config("primary")
    status, data = _request(
        "GET",
        _store_path(cfg["store_id"], f"/invoices/{urllib.parse.quote(str(invoice_id), safe='')}"),
        None,
        cfg,
    )
    if status >= 400 or not isinstance(data, dict):
        raise BtcPayError("Failed to load invoice status from BTCPay.", status, data)
    return _attach_invoice_meta(data, cfg)


def apply_order_update(
    order: Order,
    *,
    status: str | None = None,
    payment_status: str | None = None,
    mark_paid_at: bool = False,
    restock: bool = False,
    send_paid_mail: bool = False,
    send_status: bool = True,
) -> None:
    from cms.mailer import send_order_event, send_order_status_event

    if order.status in LOCKED_STATUSES:
        return
    previous = order.status
    fields = ["updated_at"]
    if status and order.status != status:
        order.status = status
        fields.append("status")
    if payment_status and order.payment_status != payment_status:
        order.payment_status = payment_status
        fields.append("payment_status")
    if mark_paid_at and not order.paid_at:
        order.paid_at = timezone.now()
        fields.append("paid_at")
    if len(fields) == 1:
        return
    order.save(update_fields=fields)
    if restock and previous not in (Order.Status.CANCELLED, Order.Status.FAILED):
        restock_order(order)
        apply_group_shipping(order.group_id)
    if send_status and previous != order.status:
        send_order_status_event(order)
    if send_paid_mail:
        send_order_event("order_paid", order)


def mark_settled(order: Order) -> None:
    siblings = live_group_orders(order)
    for index, sibling in enumerate(siblings):
        apply_order_update(
            sibling,
            status=Order.Status.PROCESSING,
            payment_status=Order.PaymentStatus.PAID,
            mark_paid_at=True,
            send_paid_mail=index == 0,
            send_status=index == 0,
        )


def mark_on_hold(order: Order) -> None:
    for sibling in live_group_orders(order):
        if sibling.payment_status == Order.PaymentStatus.PAID:
            continue
        apply_order_update(
            sibling,
            status=Order.Status.ON_HOLD,
            payment_status=Order.PaymentStatus.PENDING,
        )


def mark_failed(order: Order, payment_status: str) -> None:
    for sibling in live_group_orders(order):
        if sibling.payment_status == Order.PaymentStatus.PAID and payment_status != Order.PaymentStatus.PAID:
            continue
        apply_order_update(
            sibling,
            status=Order.Status.FAILED,
            payment_status=payment_status,
        )


def cancel_unpaid(order: Order) -> None:
    for sibling in live_group_orders(order):
        if sibling.payment_status == Order.PaymentStatus.PAID:
            continue
        apply_order_update(
            sibling,
            status=Order.Status.CANCELLED,
            payment_status=Order.PaymentStatus.FAILED,
            restock=True,
        )


def sync_order_from_invoice(order: Order, invoice: BtcInvoice, mapped: str, invoice_data: dict) -> None:
    if indicates_paid_late(invoice_data):
        mark_failed(order, Order.PaymentStatus.FAILED)
        return
    if indicates_partial(invoice_data):
        mark_failed(order, Order.PaymentStatus.PARTIAL)
        return
    if mapped == BtcInvoice.Status.CONFIRMED:
        mark_on_hold(order)
        return
    if mapped == BtcInvoice.Status.PAID:
        for sibling in live_group_orders(order):
            if sibling.payment_status != Order.PaymentStatus.PAID:
                apply_order_update(
                    sibling,
                    payment_status=Order.PaymentStatus.PAID,
                    mark_paid_at=True,
                )
        return
    if mapped == BtcInvoice.Status.COMPLETE:
        mark_settled(order)


def update_invoice_status(invoice: BtcInvoice) -> BtcInvoice:
    data = fetch_invoice(invoice.invoice_id, invoice=invoice)
    mapped = map_status(data.get("status") or "New")
    fields = ["status", "btc_pay_response", "updated_at"]
    invoice.status = mapped
    invoice.btc_pay_response = data
    if not invoice.payment_address:
        details = extract_payment_details(data)
        if details["payment_address"]:
            invoice.payment_address = details["payment_address"]
            invoice.crypto_code = invoice.crypto_code or details["crypto_code"]
            fields.extend(["payment_address", "crypto_code"])
    now = timezone.now()
    if mapped == BtcInvoice.Status.PAID and not invoice.paid_at:
        invoice.paid_at = now
        fields.append("paid_at")
    if mapped == BtcInvoice.Status.CONFIRMED and not invoice.confirmed_at:
        invoice.confirmed_at = now
        fields.append("confirmed_at")
    if mapped == BtcInvoice.Status.COMPLETE and not invoice.completed_at:
        invoice.completed_at = now
        invoice.paid_at = invoice.paid_at or now
        fields.extend(["completed_at", "paid_at"])
    invoice.save(update_fields=fields)
    sync_order_from_invoice(invoice.order, invoice, mapped, data)
    return invoice


def _webhook_secrets() -> list[str]:
    secrets_list: list[str] = []
    for key in (SETTING_KEYS["webhook_secret"], SECONDARY_SETTING_KEYS["webhook_secret"]):
        secret = setting_get(key).strip()
        if secret and secret not in secrets_list:
            secrets_list.append(secret)
    return secrets_list


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    secrets_list = _webhook_secrets()
    # No secret saved yet → accept (same as prior primary-only behavior).
    if not secrets_list:
        return True
    if not raw_body or not signature:
        return False
    sig = signature.strip()
    if sig.lower().startswith("sha256="):
        sig = sig.split("=", 1)[1]
    for secret in secrets_list:
        digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if hmac.compare_digest(digest, sig):
            return True
    return False


def normalize_webhook(payload: dict) -> tuple[str | None, str | None]:
    event_type = payload.get("type")
    invoice_id = payload.get("invoiceId") or payload.get("invoice_id")
    data = payload.get("data")
    if not invoice_id and isinstance(data, dict):
        invoice_id = data.get("invoiceId") or data.get("invoice_id") or data.get("id")
        event_type = event_type or data.get("type")
    return (
        event_type if isinstance(event_type, str) else None,
        str(invoice_id) if invoice_id else None,
    )


def handle_webhook(payload: dict, signature: str | None, raw_body: bytes) -> None:
    if not verify_webhook_signature(raw_body, signature):
        raise BtcPayError("Invalid webhook signature")
    event_type, invoice_id = normalize_webhook(payload)
    if not invoice_id:
        logger.warning("BTCPay webhook missing invoice id")
        return
    invoice = BtcInvoice.objects.select_related("order").filter(invoice_id=invoice_id).first()
    if not invoice:
        logger.warning("BTCPay invoice not found: %s", invoice_id)
        return
    try:
        update_invoice_status(invoice)
    except BtcPayError:
        logger.exception("BTCPay invoice refresh failed during webhook")
    invoice.refresh_from_db()
    order = invoice.order
    apply_webhook_event(order, invoice, event_type, payload)


def apply_webhook_event(order: Order, invoice: BtcInvoice, event_type: str | None, payload: dict) -> None:
    data = invoice.btc_pay_response if isinstance(invoice.btc_pay_response, dict) else {}
    if event_type in ("InvoiceReceivedPayment", "InvoicePaymentSettled", "InvoiceProcessing"):
        mark_on_hold(order)
        return
    if event_type in ("InvoiceSettled", "InvoiceComplete"):
        if webhook_flag(payload, "afterExpiration") or indicates_paid_late(data):
            mark_failed(order, Order.PaymentStatus.FAILED)
            return
        mark_settled(order)
        return
    if event_type == "InvoiceExpired":
        if webhook_flag(payload, "partiallyPaid") or indicates_partial(data):
            mark_failed(order, Order.PaymentStatus.PARTIAL)
            return
        if order.payment_status == Order.PaymentStatus.PENDING:
            cancel_unpaid(order)
        return
    if event_type == "InvoiceInvalid":
        mark_failed(order, Order.PaymentStatus.FAILED)


def test_connection(profile: str | None = "primary") -> dict:
    code = normalize_profile(profile)
    if not is_configured(code):
        raise BtcPayError(
            f"Save the {'failover ' if code == 'secondary' else ''}server URL, API key, and store ID first."
        )
    cfg = get_config(code)
    extracted_store_id = None
    permissions: list[str] = []
    status, key_data = _request("GET", "/api/v1/api-keys/current", None, cfg)
    if status < 400 and isinstance(key_data, dict):
        permissions = key_data.get("permissions") or []
        for permission in permissions:
            if isinstance(permission, str) and ":" in permission:
                extracted_store_id = permission.split(":", 1)[1] or extracted_store_id
    status, store = _request("GET", _store_path(cfg["store_id"]), None, cfg)
    if status == 401:
        raise BtcPayError("Unauthenticated. Check the API key.")
    if status == 403:
        message = ""
        if isinstance(store, dict):
            message = store.get("message") or store.get("missingPermission") or ""
        raise BtcPayError(message or "API key is missing store permissions.")
    if status >= 400:
        hint = ""
        if extracted_store_id and extracted_store_id != cfg["store_id"]:
            hint = f" API key appears bound to store {extracted_store_id}."
        message = store.get("message") if isinstance(store, dict) else ""
        raise BtcPayError((message or "Could not load the BTCPay store.") + hint)
    name = store.get("name") if isinstance(store, dict) else None
    label = "failover BTCPay" if code == "secondary" else "BTCPay store"
    return {
        "connected": True,
        "profile": code,
        "storeName": name,
        "storeId": cfg["store_id"],
        "permissions": permissions,
        "extractedStoreId": extracted_store_id,
        "message": f"Connected to {name or label}.",
    }


def webhook_status(profile: str | None = "primary") -> dict:
    """GreatLife-aligned status: trust saved webhook, soft-fail list errors."""
    code = normalize_profile(profile)
    keys = _keys_for_profile(code)
    if not is_configured(code):
        return {"configured": False, "message": "BTCPay not configured", "profile": code}
    cfg = get_config(code)
    expected = webhook_public_url()
    stored_id = setting_get(keys["webhook_id"])
    stored_secret = setting_get(keys["webhook_secret"])
    if stored_id and stored_secret:
        return {
            "configured": True,
            "message": "Webhook is configured",
            "webhookId": stored_id,
            "profile": code,
        }

    status, data = _request("GET", _store_path(cfg["store_id"], "/webhooks"), None, cfg)
    if status >= 400:
        # GreatLife: auth/list failures become a soft "No webhook setup, yet."
        # (except hard unauthenticated), instead of a repeating permission alarm.
        if status == 401:
            return {
                "configured": False,
                "message": "Unauthenticated. Please check your API key.",
                "httpStatus": status,
                "profile": code,
            }
        return {
            "configured": False,
            "message": "No webhook setup, yet.",
            "httpStatus": status,
            "profile": code,
        }

    path = "/api/btc/webhook"
    for item in _normalize_webhook_rows(data):
        url = item.get("url") or ""
        if path in url or url.rstrip("/") == expected.rstrip("/"):
            return {
                "configured": True,
                "message": "Webhook is configured",
                "webhookId": item.get("id"),
                "profile": code,
            }
    if stored_id:
        return {
            "configured": True,
            "message": "Webhook is configured",
            "webhookId": stored_id,
            "profile": code,
        }
    return {"configured": False, "message": "No webhook setup, yet.", "profile": code}


def _persist_webhook(data: dict, url: str, profile: str | None = "primary") -> dict:
    code = normalize_profile(profile)
    keys = _keys_for_profile(code)
    secret = str(data.get("secret") or "")
    webhook_id = str(data.get("id") or "")
    label_suffix = " (failover)" if code == "secondary" else ""
    if secret:
        setting_set(keys["webhook_secret"], secret, f"BTCPay webhook secret{label_suffix}")
    if webhook_id:
        setting_set(keys["webhook_id"], webhook_id, f"BTCPay webhook id{label_suffix}")
    setting_set(keys["webhook_url"], url, f"BTCPay webhook URL{label_suffix}")
    return {
        "configured": True,
        "message": "Webhook created on BTCPay Server.",
        "webhookId": webhook_id,
        "webhookUrl": url,
        "webhookSecret": mask_secret(secret),
        "profile": code,
    }


def setup_webhook(profile: str | None = "primary") -> dict:
    """Create store webhook like GreatLife (specific events, then everything=true fallback)."""
    code = normalize_profile(profile)
    keys = _keys_for_profile(code)
    if not is_configured(code):
        raise BtcPayError("Save the server URL, API key, and store ID first.")
    cfg = get_config(code)
    url = webhook_public_url()
    stored_id = setting_get(keys["webhook_id"])
    stored_secret = setting_get(keys["webhook_secret"])
    if stored_id and stored_secret:
        return {
            "configured": True,
            "message": "Webhook is already configured.",
            "webhookId": stored_id,
            "webhookUrl": url,
            "profile": code,
        }

    # If list works and our URL already exists, adopt it (secret may already be saved manually).
    list_status, list_data = _request("GET", _store_path(cfg["store_id"], "/webhooks"), None, cfg)
    if list_status < 400:
        path = "/api/btc/webhook"
        for item in _normalize_webhook_rows(list_data):
            item_url = item.get("url") or ""
            if path in item_url or item_url.rstrip("/") == url.rstrip("/"):
                webhook_id = str(item.get("id") or "")
                label_suffix = " (failover)" if code == "secondary" else ""
                if webhook_id:
                    setting_set(keys["webhook_id"], webhook_id, f"BTCPay webhook id{label_suffix}")
                setting_set(keys["webhook_url"], url, f"BTCPay webhook URL{label_suffix}")
                return {
                    "configured": True,
                    "message": "Webhook already exists",
                    "webhookId": webhook_id,
                    "webhookUrl": url,
                    "profile": code,
                }

    specific_payload = {
        "enabled": True,
        "automaticRedelivery": True,
        "url": url,
        "authorizedEvents": {"everything": False, "specificEvents": WEBHOOK_EVENTS},
    }
    status, data = _request("POST", _store_path(cfg["store_id"], "/webhooks"), specific_payload, cfg)
    if status < 400 and isinstance(data, dict) and data.get("id"):
        return _persist_webhook(data, url, code)

    # GreatLife HTTP fallback: create with everything=true when specific-event create fails.
    fallback_payload = {
        "enabled": True,
        "automaticRedelivery": True,
        "url": url,
        "authorizedEvents": {"everything": True},
    }
    status2, data2 = _request("POST", _store_path(cfg["store_id"], "/webhooks"), fallback_payload, cfg)
    if status2 < 400 and isinstance(data2, dict) and data2.get("id"):
        return _persist_webhook(data2, url, code)

    message = ""
    err_payload = data2 if isinstance(data2, dict) else data if isinstance(data, dict) else {}
    if isinstance(err_payload, dict):
        message = str(err_payload.get("message") or err_payload.get("error") or "")
        if err_payload.get("missingPermission"):
            message = (
                message
                or f"Missing permission {err_payload['missingPermission']}. "
                "Create an API key with Store: Can modify webhooks, or add the webhook manually "
                f"in BTCPay to {url} and paste the secret here."
            )
    raise BtcPayError(
        message or "Failed to create the BTCPay webhook.",
        status2 if status2 >= 400 else status,
        err_payload,
    )


def _profile_admin_block(profile: str) -> dict:
    code = normalize_profile(profile)
    keys = _keys_for_profile(code)
    cfg = get_config(code)
    secret = setting_get(keys["webhook_secret"])
    enabled = True if code == "primary" else setting_get(SECONDARY_SETTING_KEYS["enabled"], "1") != "0"
    return {
        "profile": code,
        "serverUrl": cfg["server_url"],
        "apiKey": mask_secret(cfg["api_key"]),
        "storeId": cfg["store_id"],
        "webhookSecret": mask_secret(secret),
        "isConfigured": is_configured(code),
        "enabled": enabled if code == "secondary" else True,
        "webhookStatus": webhook_status(code),
    }


def admin_payload() -> dict:
    primary = _profile_admin_block("primary")
    secondary = _profile_admin_block("secondary")
    return {
        "serverUrl": primary["serverUrl"],
        "apiKey": primary["apiKey"],
        "storeId": primary["storeId"],
        "webhookSecret": primary["webhookSecret"],
        "isConfigured": primary["isConfigured"],
        "webhookStatus": primary["webhookStatus"],
        "webhookUrl": webhook_public_url(),
        "invoiceExpirationMinutes": invoice_expiration_minutes(),
        "defaultCustomerMessage": setting_get(
            SETTING_KEYS["default_customer_message"],
            "You will be redirected to BTC Payment Server.",
        ),
        "requiredPermissions": {
            "btcpay.store.canviewstoresettings": "Store: Can view and modify store settings",
            "btcpay.store.canmodifyinvoices": "Store: Can create, view, update and delete invoices",
            "btcpay.store.webhooks.canmodifywebhooks": "Store: Can modify webhooks",
            "btcpay.store.canviewinvoices": "Store: Can view invoices",
            "btcpay.store.cancreateinvoice": "Store: Can create invoices",
        },
        "apiKeysUrl": f"{primary['serverUrl']}/account/apikeys" if primary["serverUrl"] else "",
        "failover": {
            "enabled": bool(secondary.get("enabled")),
            "serverUrl": secondary["serverUrl"],
            "apiKey": secondary["apiKey"],
            "storeId": secondary["storeId"],
            "webhookSecret": secondary["webhookSecret"],
            "isConfigured": secondary["isConfigured"],
            "webhookStatus": secondary["webhookStatus"],
            "webhookUrl": webhook_public_url(),
        },
    }


def authorize_callback_url(state: str) -> str:
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    return f"{base}/api/admin/btcpay/callback?state={urllib.parse.quote(state)}"


def build_authorize_url(server_url: str, state: str) -> str:
    host = clean_server_url(server_url)
    if not host:
        raise BtcPayError("Enter your BTCPay Server URL first (https://…).")
    if not host.startswith(("https://", "http://")):
        raise BtcPayError("BTCPay Server URL must start with https://")
    query: list[tuple[str, str]] = [
        ("applicationName", "Invictus Pharma"),
        ("applicationIdentifier", "invictuspharma"),
        ("strict", "true"),
        ("selectiveStores", "true"),
        ("redirect", authorize_callback_url(state)),
    ]
    for permission in AUTHORIZE_PERMISSIONS:
        query.append(("permissions", permission))
    return f"{host}/api-keys/authorize?{urllib.parse.urlencode(query)}"


def start_authorize(server_url: str, profile: str | None = "primary") -> dict:
    code = normalize_profile(profile)
    host = clean_server_url(server_url)
    if not host:
        raise BtcPayError("Enter your BTCPay Server URL first.")
    state = secrets.token_urlsafe(24)
    setting_set(SETTING_KEYS["authorize_state"], state, "BTCPay authorize state")
    setting_set(SETTING_KEYS["authorize_server_url"], host, "BTCPay authorize server URL")
    setting_set(SETTING_KEYS["authorize_profile"], code, "BTCPay authorize profile")
    keys = _keys_for_profile(code)
    # Persist only this profile's server URL — never overwrite the other profile.
    label = "BTCPay failover server URL" if code == "secondary" else "BTCPay server URL"
    setting_set(keys["server_url"], host, label)
    if code == "secondary":
        setting_set(SECONDARY_SETTING_KEYS["enabled"], "1", "BTCPay failover enabled")
    return {
        "authorizeUrl": build_authorize_url(host, state),
        "serverUrl": host,
        "profile": code,
        "message": (
            "Redirecting to failover BTCPay Server to authorize Invictus Pharma."
            if code == "secondary"
            else "Redirecting to BTCPay Server to authorize Invictus Pharma."
        ),
    }


def _permission_bases(permissions: list[str]) -> list[str]:
    bases: list[str] = []
    for item in permissions:
        if not isinstance(item, str) or not item.strip():
            continue
        bases.append(item.split(":", 1)[0].strip())
    return bases


def _store_id_from_permissions(permissions: list[str]) -> str:
    store_id = ""
    for item in permissions:
        if not isinstance(item, str) or ":" not in item:
            continue
        _perm, sid = item.split(":", 1)
        sid = sid.strip()
        if not sid:
            continue
        if store_id and store_id != sid:
            raise BtcPayError("Select exactly one store on the BTCPay authorization page.")
        store_id = sid
    if not store_id:
        raise BtcPayError("BTCPay did not return a store-scoped API key. Select one store and try again.")
    return store_id


def complete_authorize(api_key: str, permissions: list[str], state: str | None = None) -> dict:
    expected = setting_get(SETTING_KEYS["authorize_state"])
    profile = normalize_profile(setting_get(SETTING_KEYS["authorize_profile"], "primary"))
    keys = _keys_for_profile(profile)
    pending_server = setting_get(SETTING_KEYS["authorize_server_url"]) or setting_get(keys["server_url"])
    state_ok = bool(expected and state and len(expected) == len(state) and secrets.compare_digest(expected, state))
    if not state_ok:
        raise BtcPayError("Authorize session expired or invalid. Start Connect with BTCPay again.")
    if not pending_server:
        raise BtcPayError("Missing BTCPay Server URL for this authorize session.")
    key = clean_api_key(api_key)
    if len(key) < 20:
        raise BtcPayError("BTCPay did not return a valid API key.")
    bases = _permission_bases(permissions)
    missing = [perm for perm in REQUIRED_AUTHORIZE_PERMISSIONS if perm not in bases]
    if missing:
        raise BtcPayError(
            "BTCPay key is missing required permissions: "
            + ", ".join(missing)
            + ". Authorize again and leave all requested permissions checked."
        )
    store_id = _store_id_from_permissions(permissions)

    # Verify the key talks to the same server we started with.
    status, _ = _request(
        "GET",
        _store_path(store_id),
        None,
        {
            "profile": profile,
            "server_url": pending_server,
            "api_key": key,
            "store_id": store_id,
            "enabled": "1",
        },
    )
    if status >= 400:
        raise BtcPayError("Could not verify the API key against the BTCPay Server URL.")

    label_suffix = " (failover)" if profile == "secondary" else ""
    setting_set(keys["server_url"], pending_server, f"BTCPay server URL{label_suffix}")
    setting_set(keys["api_key"], key, f"BTCPay API key{label_suffix}")
    setting_set(keys["store_id"], store_id, f"BTCPay store ID{label_suffix}")
    if profile == "secondary":
        setting_set(SECONDARY_SETTING_KEYS["enabled"], "1", "BTCPay failover enabled")
    setting_set(SETTING_KEYS["authorize_state"], "", "BTCPay authorize state")
    setting_set(SETTING_KEYS["authorize_server_url"], "", "BTCPay authorize server URL")
    setting_set(SETTING_KEYS["authorize_profile"], "", "BTCPay authorize profile")

    webhook_result = None
    try:
        webhook_result = setup_webhook(profile)
    except BtcPayError as exc:
        logger.warning("Authorize succeeded but webhook setup failed: %s", exc)
        webhook_result = {"configured": False, "message": str(exc), "profile": profile}

    payload = admin_payload()
    payload["message"] = (
        "Connected to failover BTCPay Server."
        if profile == "secondary"
        else "Connected to BTCPay Server."
    )
    payload["connectedProfile"] = profile
    if profile == "secondary":
        payload["failover"] = {
            **(payload.get("failover") or {}),
            "webhookStatus": webhook_result or (payload.get("failover") or {}).get("webhookStatus"),
        }
    else:
        payload["webhookStatus"] = webhook_result or payload.get("webhookStatus")
    return payload


def api_key_instructions(server_url: str | None = None) -> dict:
    host = clean_server_url(server_url or setting_get(SETTING_KEYS["server_url"]))
    if not host:
        raise BtcPayError("Please set BTCPay Server URL first")
    return {
        "instructions": [
            "1. Log in to your BTCPay Server",
            "2. Go to Account Settings → Manage Account → API Keys",
            "3. Click Create API Key (or use Connect with BTCPay for automatic setup)",
            "4. Select your store and grant ALL of these permissions:",
            "   ✓ Store: Can view and modify store settings",
            "   ✓ Store: Can create, view, update and delete invoices",
            "   ✓ Store: Can modify webhooks (required)",
            "   ✓ Store: Can view invoices / create invoices",
            "5. Click Save / Generate, copy the key, paste it under Advanced settings, then Save",
            "6. Click Test connection, then Create webhook",
        ],
        "apiKeyUrl": f"{host}/account/apikeys",
        "requiredPermissions": {
            "btcpay.store.canviewstoresettings": "Store: Can view and modify store settings",
            "btcpay.store.canmodifyinvoices": "Store: Can create, view, update and delete invoices",
            "btcpay.store.webhooks.canmodifywebhooks": "Store: Can modify webhooks",
            "btcpay.store.canviewinvoices": "Store: Can view invoices",
            "btcpay.store.cancreateinvoice": "Store: Can create invoices",
        },
    }


def _save_profile_connection(data: dict, profile: str) -> tuple[bool, str]:
    """Save one BTCPay profile. Returns (user_provided_new_key, webhook_secret_or_empty)."""
    code = normalize_profile(profile)
    keys = _keys_for_profile(code)
    label_suffix = " (failover)" if code == "secondary" else ""
    server_url = clean_server_url(str(data.get("serverUrl") or data.get("server_url") or ""))
    store_id = str(data.get("storeId") or data.get("store_id") or "").strip()
    if not server_url:
        server_url = clean_server_url(setting_get(keys["server_url"]))
    if not store_id:
        store_id = setting_get(keys["store_id"]).strip()
    incoming = clean_api_key(str(data.get("apiKey") or data.get("api_key") or ""))
    if incoming.startswith("***"):
        incoming = ""
    existing = clean_api_key(setting_get(keys["api_key"]))
    if not incoming:
        if not existing and code == "primary":
            raise BtcPayError("API key is required on first setup. Paste the full BTCPay API key.")
        if not existing and code == "secondary" and (server_url or store_id):
            raise BtcPayError("Failover API key is required. Paste the full BTCPay API key.")
        api_key = existing
        user_provided_new_key = False
    else:
        if len(incoming) < 20:
            raise BtcPayError("API key looks incomplete. Copy the full key from BTCPay Server.")
        api_key = incoming
        user_provided_new_key = True
    if code == "primary" and (not server_url or not store_id):
        raise BtcPayError("Server URL and store ID are required.")
    if code == "secondary":
        enabled_raw = data.get("enabled")
        if enabled_raw is None:
            enabled = True
        else:
            enabled = str(enabled_raw).strip().lower() not in ("0", "false", "off", "no", "")
        setting_set(
            SECONDARY_SETTING_KEYS["enabled"],
            "1" if enabled else "0",
            "BTCPay failover enabled",
        )
        # Allow disabling failover without requiring full credentials.
        if not enabled:
            return False, ""
        if not server_url or not store_id or not api_key:
            raise BtcPayError("Failover needs server URL, store ID, and API key when enabled.")

    if server_url:
        setting_set(keys["server_url"], server_url, f"BTCPay server URL{label_suffix}")
    if api_key:
        setting_set(keys["api_key"], api_key, f"BTCPay API key{label_suffix}")
    if store_id:
        setting_set(keys["store_id"], store_id, f"BTCPay store ID{label_suffix}")

    webhook_secret = str(data.get("webhookSecret") or data.get("webhook_secret") or "").strip()
    if webhook_secret and not webhook_secret.startswith("***"):
        setting_set(keys["webhook_secret"], webhook_secret, f"BTCPay webhook secret{label_suffix}")
    return user_provided_new_key, webhook_secret if not webhook_secret.startswith("***") else ""


def save_admin_settings(data: dict) -> dict:
    profile = normalize_profile(str(data.get("profile") or "primary"))

    # Shared checkout options only live on primary saves (keeps failover form isolated).
    if profile == "primary":
        user_provided_new_key, webhook_secret = _save_profile_connection(data, "primary")
        minutes = data.get("invoiceExpirationMinutes")
        if minutes is None:
            minutes = data.get("invoice_expiration_minutes", 480)
        try:
            minutes_int = max(5, min(10080, int(minutes)))
        except (TypeError, ValueError):
            minutes_int = 480
        setting_set(
            SETTING_KEYS["invoice_expiration_minutes"],
            str(minutes_int),
            "Invoice expiration minutes",
        )
        message = data.get("defaultCustomerMessage") or data.get("default_customer_message")
        if message is not None:
            setting_set(
                SETTING_KEYS["default_customer_message"],
                str(message),
                "BTCPay checkout message",
            )
        # Optional nested failover payload on the same primary save.
        failover_data = data.get("failover")
        if isinstance(failover_data, dict):
            _save_profile_connection(failover_data, "secondary")
    else:
        user_provided_new_key, webhook_secret = _save_profile_connection(data, "secondary")

    webhook_result = None
    if user_provided_new_key and not webhook_secret and is_configured(profile):
        try:
            webhook_result = setup_webhook(profile)
        except BtcPayError as exc:
            logger.warning("Auto webhook setup failed (%s): %s", profile, exc)

    payload = admin_payload()
    payload["message"] = (
        "Failover BTCPay settings saved."
        if profile == "secondary"
        else "BTCPay settings saved."
    )
    payload["savedProfile"] = profile
    if webhook_result:
        if profile == "secondary":
            payload["failover"] = {
                **(payload.get("failover") or {}),
                "webhookStatus": webhook_result,
            }
        else:
            payload["webhookStatus"] = webhook_result
    return payload
