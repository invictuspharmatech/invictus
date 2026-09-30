from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import ssl
import urllib.error
import urllib.request
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from cms.models import SiteSetting
from orders.fulfillment import apply_group_shipping, restock_order
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
}

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


def get_config() -> dict[str, str]:
    server_url = clean_server_url(setting_get(SETTING_KEYS["server_url"]))
    api_key = clean_api_key(setting_get(SETTING_KEYS["api_key"]))
    store_id = setting_get(SETTING_KEYS["store_id"]).strip()
    return {"server_url": server_url, "api_key": api_key, "store_id": store_id}


def is_configured() -> bool:
    cfg = get_config()
    return bool(cfg["server_url"] and cfg["api_key"] and cfg["store_id"])


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


def _request(method: str, path: str, payload: dict | None = None, config: dict | None = None) -> tuple[int, Any]:
    cfg = config or get_config()
    url = cfg["server_url"].rstrip("/") + path
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"token {cfg['api_key']}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
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
    cfg = get_config()
    for invoice in existing:
        if (invoice.status or "").lower() in ("complete", "paid"):
            raise BtcPayError("This order already has a settled Bitcoin invoice.")
        try:
            _request(
                "POST",
                f"/api/v1/stores/{cfg['store_id']}/invoices/{invoice.invoice_id}/status",
                {"status": "Invalid"},
                cfg,
            )
        except Exception:
            logger.warning("Could not mark BTCPay invoice invalid", extra={"invoice_id": invoice.invoice_id})
        invoice.delete()


def create_invoice(order: Order) -> BtcInvoice:
    if checkout_window_closed(order):
        raise BtcPayError("This Bitcoin payment link has expired. Place a new order to pay.")
    if not is_configured():
        raise BtcPayError("BTCPay Server is not connected. An admin must save the server URL, API key, and store ID.")
    if not order.order_number:
        raise BtcPayError("Order number is required to create a BTCPay invoice.")

    supersede_existing(order)
    cfg = get_config()
    from orders.pay_token import checkout_url

    payload = {
        "amount": f"{order.grand_total:.2f}",
        "currency": "USD",
        "metadata": {
            "orderId": order.order_number,
            "buyerEmail": order.customer_email,
            "itemDesc": f"Invictus Pharma {order.order_number}",
        },
        "checkout": {
            "redirectURL": checkout_url(order),
            "expirationMinutes": invoice_expiration_minutes(),
        },
    }
    status, data = _request("POST", f"/api/v1/stores/{cfg['store_id']}/invoices", payload, cfg)
    if status >= 400 or not isinstance(data, dict) or not data.get("id"):
        message = ""
        if isinstance(data, dict):
            message = data.get("message") or data.get("error") or ""
        raise BtcPayError(message or "Failed to create BTCPay invoice.", status, data)

    details = extract_payment_details(data)
    return BtcInvoice.objects.create(
        order=order,
        invoice_id=data["id"],
        store_id=cfg["store_id"],
        amount=order.grand_total,
        currency="USD",
        crypto_code=details["crypto_code"],
        crypto_amount=details["crypto_amount"],
        payment_address=details["payment_address"],
        status=map_status(data.get("status") or "New"),
        expires_at=_parse_expiry(data.get("expirationTime")),
        btc_pay_response=data,
    )


def fetch_invoice(invoice_id: str) -> dict:
    cfg = get_config()
    status, data = _request("GET", f"/api/v1/stores/{cfg['store_id']}/invoices/{invoice_id}", None, cfg)
    if status >= 400 or not isinstance(data, dict):
        raise BtcPayError("Failed to load invoice status from BTCPay.", status, data)
    return data


LOCKED_STATUSES = {
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
}


def apply_order_update(
    order: Order,
    *,
    status: str | None = None,
    payment_status: str | None = None,
    mark_paid_at: bool = False,
    restock: bool = False,
    send_paid_mail: bool = False,
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
    if previous != order.status:
        send_order_status_event(order)
    if send_paid_mail:
        send_order_event("order_paid", order)


def mark_settled(order: Order) -> None:
    apply_order_update(
        order,
        status=Order.Status.PROCESSING,
        payment_status=Order.PaymentStatus.PAID,
        mark_paid_at=True,
        send_paid_mail=True,
    )


def mark_on_hold(order: Order) -> None:
    if order.payment_status == Order.PaymentStatus.PAID:
        return
    apply_order_update(
        order,
        status=Order.Status.ON_HOLD,
        payment_status=Order.PaymentStatus.PENDING,
    )


def mark_failed(order: Order, payment_status: str) -> None:
    if order.payment_status == Order.PaymentStatus.PAID and payment_status != Order.PaymentStatus.PAID:
        return
    apply_order_update(
        order,
        status=Order.Status.FAILED,
        payment_status=payment_status,
    )


def cancel_unpaid(order: Order) -> None:
    if order.payment_status == Order.PaymentStatus.PAID:
        return
    apply_order_update(
        order,
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
        if order.payment_status != Order.PaymentStatus.PAID:
            apply_order_update(
                order,
                payment_status=Order.PaymentStatus.PAID,
                mark_paid_at=True,
            )
        return
    if mapped == BtcInvoice.Status.COMPLETE:
        mark_settled(order)


def update_invoice_status(invoice: BtcInvoice) -> BtcInvoice:
    data = fetch_invoice(invoice.invoice_id)
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


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    secret = setting_get(SETTING_KEYS["webhook_secret"]).strip()
    if not secret:
        return True
    if not raw_body or not signature:
        return False
    sig = signature.strip()
    if sig.lower().startswith("sha256="):
        sig = sig.split("=", 1)[1]
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, sig)


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


def test_connection() -> dict:
    if not is_configured():
        raise BtcPayError("Save the server URL, API key, and store ID first.")
    cfg = get_config()
    extracted_store_id = None
    permissions: list[str] = []
    status, key_data = _request("GET", "/api/v1/api-keys/current", None, cfg)
    if status < 400 and isinstance(key_data, dict):
        permissions = key_data.get("permissions") or []
        for permission in permissions:
            if isinstance(permission, str) and ":" in permission:
                extracted_store_id = permission.split(":", 1)[1] or extracted_store_id
    status, store = _request("GET", f"/api/v1/stores/{cfg['store_id']}", None, cfg)
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
    return {
        "connected": True,
        "storeName": name,
        "storeId": cfg["store_id"],
        "permissions": permissions,
        "extractedStoreId": extracted_store_id,
        "message": f"Connected to {name or 'BTCPay store'}.",
    }


def webhook_status() -> dict:
    if not is_configured():
        return {"configured": False, "message": "BTCPay not configured"}
    cfg = get_config()
    expected = webhook_public_url()
    status, data = _request("GET", f"/api/v1/stores/{cfg['store_id']}/webhooks", None, cfg)
    if status >= 400:
        message = data.get("message") if isinstance(data, dict) else "Could not list webhooks."
        if status in (401, 403):
            return {"configured": False, "message": message or "API key cannot view webhooks."}
        return {"configured": False, "message": "No webhook setup, yet."}
    webhooks = data if isinstance(data, list) else []
    path = "/api/btc/webhook"
    for item in webhooks:
        if not isinstance(item, dict):
            continue
        url = item.get("url") or ""
        if path in url or url.rstrip("/") == expected.rstrip("/"):
            return {
                "configured": True,
                "message": "Webhook is configured",
                "webhookId": item.get("id"),
            }
    stored_id = setting_get(SETTING_KEYS["webhook_id"])
    if stored_id:
        return {"configured": True, "message": "Webhook is configured", "webhookId": stored_id}
    return {"configured": False, "message": "No webhook setup, yet."}


def setup_webhook() -> dict:
    if not is_configured():
        raise BtcPayError("Save the server URL, API key, and store ID first.")
    cfg = get_config()
    url = webhook_public_url()
    current = webhook_status()
    if current.get("configured"):
        return {
            "configured": True,
            "message": "Webhook is already configured.",
            "webhookId": current.get("webhookId"),
            "webhookUrl": url,
        }
    payload = {
        "enabled": True,
        "automaticRedelivery": True,
        "url": url,
        "authorizedEvents": {"everything": False, "specificEvents": WEBHOOK_EVENTS},
    }
    status, data = _request("POST", f"/api/v1/stores/{cfg['store_id']}/webhooks", payload, cfg)
    if status >= 400 or not isinstance(data, dict):
        message = ""
        if isinstance(data, dict):
            message = data.get("message") or data.get("error") or ""
            if data.get("missingPermission"):
                message = (
                    message
                    or f"Missing permission {data['missingPermission']}. Create an API key that can modify webhooks."
                )
        raise BtcPayError(message or "Failed to create the BTCPay webhook.", status, data)
    secret = data.get("secret") or ""
    webhook_id = data.get("id") or ""
    if secret:
        setting_set(SETTING_KEYS["webhook_secret"], secret, "BTCPay webhook secret")
    if webhook_id:
        setting_set(SETTING_KEYS["webhook_id"], webhook_id, "BTCPay webhook id")
    setting_set(SETTING_KEYS["webhook_url"], url, "BTCPay webhook URL")
    return {
        "configured": True,
        "message": "Webhook created on BTCPay Server.",
        "webhookId": webhook_id,
        "webhookUrl": url,
        "webhookSecret": mask_secret(secret),
    }


def admin_payload() -> dict:
    cfg = get_config()
    secret = setting_get(SETTING_KEYS["webhook_secret"])
    return {
        "serverUrl": cfg["server_url"],
        "apiKey": mask_secret(cfg["api_key"]),
        "storeId": cfg["store_id"],
        "webhookSecret": mask_secret(secret),
        "isConfigured": is_configured(),
        "webhookStatus": webhook_status(),
        "webhookUrl": webhook_public_url(),
        "invoiceExpirationMinutes": invoice_expiration_minutes(),
        "defaultCustomerMessage": setting_get(
            SETTING_KEYS["default_customer_message"],
            "You will be redirected to BTC Payment Server.",
        ),
    }


def save_admin_settings(data: dict) -> dict:
    server_url = clean_server_url(str(data.get("serverUrl") or data.get("server_url") or ""))
    store_id = str(data.get("storeId") or data.get("store_id") or "").strip()
    incoming = clean_api_key(str(data.get("apiKey") or data.get("api_key") or ""))
    if incoming.startswith("***"):
        incoming = ""
    existing = clean_api_key(setting_get(SETTING_KEYS["api_key"]))
    if not incoming:
        if not existing:
            raise BtcPayError("API key is required on first setup. Paste the full BTCPay API key.")
        api_key = existing
        user_provided_new_key = False
    else:
        if len(incoming) < 20:
            raise BtcPayError("API key looks incomplete. Copy the full key from BTCPay Server.")
        api_key = incoming
        user_provided_new_key = True
    if not server_url or not store_id:
        raise BtcPayError("Server URL and store ID are required.")

    setting_set(SETTING_KEYS["server_url"], server_url, "BTCPay server URL")
    setting_set(SETTING_KEYS["api_key"], api_key, "BTCPay API key")
    setting_set(SETTING_KEYS["store_id"], store_id, "BTCPay store ID")

    webhook_secret = str(data.get("webhookSecret") or data.get("webhook_secret") or "").strip()
    if webhook_secret and not webhook_secret.startswith("***"):
        setting_set(SETTING_KEYS["webhook_secret"], webhook_secret, "BTCPay webhook secret")

    minutes = data.get("invoiceExpirationMinutes")
    if minutes is None:
        minutes = data.get("invoice_expiration_minutes", 480)
    try:
        minutes_int = max(5, min(10080, int(minutes)))
    except (TypeError, ValueError):
        minutes_int = 480
    setting_set(SETTING_KEYS["invoice_expiration_minutes"], str(minutes_int), "Invoice expiration minutes")

    message = data.get("defaultCustomerMessage") or data.get("default_customer_message")
    if message is not None:
        setting_set(
            SETTING_KEYS["default_customer_message"],
            str(message),
            "BTCPay checkout message",
        )

    webhook_result = None
    if user_provided_new_key and not webhook_secret:
        try:
            webhook_result = setup_webhook()
        except BtcPayError as exc:
            logger.warning("Auto webhook setup failed: %s", exc)

    payload = admin_payload()
    payload["message"] = "BTCPay settings saved."
    if webhook_result:
        payload["webhookStatus"] = webhook_result
    return payload
