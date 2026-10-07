import json
import ssl
import urllib.error
import urllib.parse
import urllib.request

from django.utils import timezone

from orders.models import BitcoinPostageSender, BitcoinPostageSettings, Order, ShippingLabel


class BitcoinPostageError(Exception):
    pass


def get_settings() -> BitcoinPostageSettings:
    row, _ = BitcoinPostageSettings.objects.get_or_create(pk=1)
    return row


def normalize_api_base(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url:
        return "https://bitcoinpostage.info/api"
    if url.endswith("/api"):
        return url
    return f"{url}/api"


def credentials() -> dict:
    row = get_settings()
    return {
        "api_url": normalize_api_base(row.api_url),
        "key": (row.api_key or "").strip(),
        "secret": (row.api_secret or "").strip(),
    }


def _auth_form() -> dict:
    creds = credentials()
    return {"key": creds["key"], "secret": creds["secret"]}


def _option(options: dict, *keys: str, default: str = "") -> str:
    for key in keys:
        value = options.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


CREATE_PURCHASE_PATH = "/create-purchase"
# Great Life / WooCommerce plugin: POST https://bitcoinpostage.info/api/create-purchase
BTCPOSTAGE_USER_AGENT = (
    "BitcoinPostage-WooCommerce-Plugin/1.09 (compatible; InvictusPharma)"
)


def _post_form(url: str, form: dict) -> dict:
    payload = urllib.parse.urlencode({k: "" if v is None else str(v) for k, v in form.items()}).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", BTCPOSTAGE_USER_AGENT)
    req.add_header("Accept", "application/json, text/plain, */*")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        raise BitcoinPostageError(f"Bitcoin Postage HTTP {exc.code}: {detail[:500]}") from exc
    except urllib.error.URLError as exc:
        raise BitcoinPostageError(f"Bitcoin Postage request failed: {exc.reason}") from exc
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError as exc:
        raise BitcoinPostageError(f"Bitcoin Postage returned non-JSON: {body[:300]}") from exc
    if not isinstance(data, dict):
        raise BitcoinPostageError("Bitcoin Postage returned an unexpected payload.")
    return data


def _first_item(result: dict) -> dict:
    items = result.get("items") or result.get("Items") or []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list) or not items or not isinstance(items[0], dict):
        raise BitcoinPostageError("Bitcoin Postage did not return a label item.")
    return items[0]


def _label_url(item: dict) -> str:
    for key in ("filename", "label_url", "url", "pdf"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _tracking(item: dict) -> str:
    for key in ("tracking_no", "tracking_number", "tracking"):
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def tracking_url_for(carrier: str, tracking: str) -> str:
    code = (carrier or "usps").lower()
    number = (tracking or "").strip()
    if not number:
        return ""
    if code == "usps":
        return f"https://tools.usps.com/go/TrackConfirmAction?tLabels={urllib.parse.quote(number)}"
    if code == "ups":
        return f"https://www.ups.com/track?tracknum={urllib.parse.quote(number)}"
    if code == "fedex":
        return f"https://www.fedex.com/fedextrack/?trknbr={urllib.parse.quote(number)}"
    return ""


def get_credits() -> dict:
    creds = credentials()
    if not creds["key"] or not creds["secret"]:
        raise BitcoinPostageError("Set the Bitcoin Postage API key and secret first.")
    result = _post_form(f"{creds['api_url']}/get-credits", _auth_form())
    raw = str(result.get("credits") or result.get("Credits") or "")
    try:
        credits = f"{float(raw):.1f}"
    except ValueError:
        credits = raw
    return {"credits": credits}


def charge_credits(amount: str, currency: str) -> dict:
    coin = (currency or "btc").strip().lower()
    if coin not in ("btc", "xmr", "ltc"):
        raise BitcoinPostageError("Currency must be btc, xmr, or ltc.")
    try:
        if float(amount) <= 0:
            raise ValueError
    except (TypeError, ValueError) as exc:
        raise BitcoinPostageError("Amount must be a positive USD number.") from exc
    creds = credentials()
    if not creds["key"] or not creds["secret"]:
        raise BitcoinPostageError("Set the Bitcoin Postage API key and secret first.")
    result = _post_form(
        f"{creds['api_url']}/charge-credits",
        {**_auth_form(), "amount": str(amount).strip(), "currency": coin},
    )
    raw = str(result.get("credits") or "")
    try:
        credits = f"{float(raw):.1f}" if raw else ""
    except ValueError:
        credits = raw
    return {
        "address": str(result.get("address") or ""),
        "id": str(result.get("id") or ""),
        "amount": str(result.get("amount") or ""),
        "timestamp": str(result.get("timestamp") or ""),
        "credits": credits,
        "purchaseId": str(result.get("purchase_id") or ""),
        "currency": str(result.get("currency") or coin),
    }


def create_label(order: Order, options: dict) -> ShippingLabel:
    creds = credentials()
    if not creds["key"] or not creds["secret"]:
        raise BitcoinPostageError("Set the Bitcoin Postage API key and secret first.")

    carrier = _option(options, "carrier", default="usps").lower()
    service = _option(
        options,
        "service",
        default="GroundAdvantage" if carrier == "usps" else "",
    )
    package_type = _option(options, "packageType", "package_type", "packagetype_usps", default="USPScustom")
    if package_type in ("USPScustom", "FedExcustom", "canadapost_custom"):
        api_package = "custom"
    else:
        api_package = package_type

    form = {
        **_auth_form(),
        "order_id": str(order.id),
        "redirect": "",
        "service": service,
        "carrier": carrier,
        "from_name": _option(options, "fromName", "from_name"),
        "from_street": _option(options, "fromStreet", "from_street"),
        "from_apt": _option(options, "fromApt", "from_apt"),
        "from_city": _option(options, "fromCity", "from_city"),
        "from_state": _option(options, "fromState", "from_state"),
        "from_zip": _option(options, "fromZip", "from_zip"),
        "from_country": _option(options, "fromCountry", "from_country", default="US"),
        "from_phone": _option(options, "fromPhone", "from_phone"),
        "to_name": _option(options, "toName", "to_name", default=order.customer_name),
        "to_street": _option(options, "toStreet", "to_street", default=order.shipping_line1),
        "to_street2": _option(options, "toStreet2", "to_street2", default=order.shipping_line2),
        "to_city": _option(options, "toCity", "to_city", default=order.shipping_city),
        "to_state": _option(options, "toState", "to_state", default=order.shipping_state),
        "to_zip": _option(options, "toZip", "to_zip", default=order.shipping_postal),
        "to_country": _option(
            options, "toCountry", "to_country", default=order.shipping_country or "US"
        ),
        "to_phone": _option(options, "toPhone", "to_phone"),
        "weight_lbs": _option(options, "weightLbs", "weight_lbs", "input_weight_lbs", default="0") or "0",
        "weight_oz": _option(options, "weightOz", "weight_oz", "input_weight_oz", default="0") or "0",
        "width": _option(options, "width", "input_width"),
        "height": _option(options, "height", "input_height"),
        "depth": _option(options, "length", "input_length"),
        "package_type": api_package,
        "label_format": _option(options, "labelFormat", "label_format", default="PDF"),
    }
    if carrier == "usps":
        form["packagetype_usps"] = package_type
        if options.get("testMode") or options.get("test_mode"):
            form["test_mode"] = "true"

    result = _post_form(f"{creds['api_url']}{CREATE_PURCHASE_PATH}", form)
    item = _first_item(result)
    filename = _label_url(item)
    if not filename:
        raise BitcoinPostageError("Bitcoin Postage did not return a label URL.")
    tracking = _tracking(item)
    label = ShippingLabel.objects.create(
        order=order,
        tracking_number=tracking,
        tracking_url=tracking_url_for(carrier, tracking),
        label_url=filename,
        carrier=carrier.upper(),
        service_type=service,
        source=ShippingLabel.Source.BTCPOSTAGE,
        raw=result,
    )
    if tracking:
        order.tracking_number = tracking
    order.status = Order.Status.COMPLETED
    if not order.shipped_at:
        order.shipped_at = timezone.now()
    order.save(update_fields=["tracking_number", "status", "shipped_at", "updated_at"])
    return label


def serialize_label(label: ShippingLabel) -> dict:
    return {
        "id": str(label.id),
        "trackingNumber": label.tracking_number,
        "trackingUrl": label.tracking_url,
        "labelUrl": label.label_url,
        "carrier": label.carrier,
        "serviceType": label.service_type,
        "source": label.source,
        "createdAt": label.created_at.isoformat(),
    }


def serialize_sender(row: BitcoinPostageSender) -> dict:
    return {
        "id": str(row.id),
        "fromName": row.from_name,
        "fromStreet": row.from_street,
        "fromApt": row.from_apt,
        "fromCity": row.from_city,
        "fromState": row.from_state,
        "fromZip": row.from_zip,
        "fromCountry": row.from_country,
        "fromPhone": row.from_phone,
        "isDefault": row.is_default,
    }
