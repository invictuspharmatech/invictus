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


DEFAULT_API_BASE = "https://bitcoinpostage.info/api"
_API_ENDPOINTS = (
    "create-purchase",
    "create-batch-purchase",
    "get-credits",
    "charge-credits",
    "get-rates",
    "retrieve-purchase",
    "retrieve-order",
    "verify-address",
    "orders",
    "register-track",
    "stop-track",
    "retrack-shipment",
    "track-shipment",
)


def normalize_api_base(url: str) -> str:
    """Return the API root (…/api), even if a full create-purchase URL was saved."""
    url = (url or "").strip()
    if not url:
        return DEFAULT_API_BASE
    url = url.split("#", 1)[0].split("?", 1)[0].rstrip("/")
    lowered = url.lower()
    for name in _API_ENDPOINTS:
        suffix = f"/{name}"
        if lowered.endswith(suffix):
            url = url[: -len(suffix)].rstrip("/")
            lowered = url.lower()
            break
    while lowered.endswith("/api/api"):
        url = url[:-4].rstrip("/")
        lowered = url.lower()
    if not lowered.endswith("/api"):
        url = f"{url.rstrip('/')}/api"
    return url


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
# Upstream often exceeds 60s (Great Life uses 300s).
HTTP_TIMEOUT_SECONDS = 300
FLAT_RATE_TYPES = frozenset({"FlatRateEnvelope", "MediumFlatRateBox"})
CUSTOM_PACKAGE_TYPES = frozenset({"USPScustom", "FedExcustom", "canadapost_custom"})


def _error_detail(status: int, url: str, body: str) -> str:
    text = (body or "").strip()
    try:
        data = json.loads(text) if text else {}
    except json.JSONDecodeError:
        data = None
    if isinstance(data, dict):
        message = data.get("message") or data.get("error") or data.get("msg")
        if isinstance(message, str) and message.strip():
            return f"Bitcoin Postage HTTP {status} ({url}): {message.strip()}"
    if text.lstrip().startswith("<!") or "<html" in text[:80].lower():
        return (
            f"Bitcoin Postage HTTP {status} ({url}): that path is not the API. "
            f"Use {DEFAULT_API_BASE} as the base URL (POST …/create-purchase)."
        )
    snippet = " ".join(text.split())[:240]
    return f"Bitcoin Postage HTTP {status} ({url}): {snippet or 'empty response'}"


def _truthy(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def _parse_json_object(text: str) -> dict | None:
    raw = (text or "").strip()
    if raw.startswith("\ufeff"):
        raw = raw.lstrip("\ufeff")
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return None
    if isinstance(data, list) and data and isinstance(data[0], dict):
        data = data[0]
    return data if isinstance(data, dict) else None


def _normalize_purchase_result(result: dict) -> dict:
    nested = result.get("data")
    if isinstance(nested, dict) and (nested.get("items") or nested.get("Items")):
        return nested
    if not result.get("items") and not result.get("Items") and result.get("filename"):
        return {"items": [result]}
    return result


def _purchase_error(result: dict) -> str:
    if result.get("items") or result.get("Items"):
        return ""
    for key in ("error", "message", "msg"):
        value = result.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _split_weight(options: dict) -> tuple[int, str]:
    lbs_raw = _option(options, "weightLbs", "weight_lbs", "input_weight_lbs", default="0") or "0"
    oz_raw = _option(options, "weightOz", "weight_oz", "input_weight_oz", default="0") or "0"
    try:
        lbs = int(float(lbs_raw))
    except ValueError:
        lbs = 0
    try:
        oz = float(oz_raw)
    except ValueError:
        oz = 0.0
    if lbs < 0:
        lbs = 0
    if oz < 0:
        oz = 0.0
    extra_lbs, oz = divmod(oz, 16)
    lbs += int(extra_lbs)
    oz_text = str(int(oz)) if oz == int(oz) else str(round(oz, 2))
    return lbs, oz_text


def _api_package_type(package_type: str) -> str:
    if package_type in CUSTOM_PACKAGE_TYPES:
        return "custom"
    return package_type


def _flat_rate_dimensions(package_type: str) -> dict[str, str]:
    if package_type == "MediumFlatRateBox":
        return {"width": "8.5", "height": "5.5", "depth": "11"}
    return {"width": "9.5", "height": "0.75", "depth": "12.5"}


def _default_sender() -> BitcoinPostageSender | None:
    return BitcoinPostageSender.objects.filter(is_default=True).first() or BitcoinPostageSender.objects.first()


def _post_form(url: str, form: dict) -> dict:
    url = (url or "").rstrip("/")
    payload = urllib.parse.urlencode({k: "" if v is None else str(v) for k, v in form.items()}).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", BTCPOSTAGE_USER_AGENT)
    req.add_header("Accept", "application/json, text/plain, */*")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS, context=ctx) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        raise BitcoinPostageError(_error_detail(exc.code, url, detail)) from exc
    except urllib.error.URLError as exc:
        raise BitcoinPostageError(f"Bitcoin Postage request failed ({url}): {exc.reason}") from exc
    data = _parse_json_object(body)
    if data is None:
        raise BitcoinPostageError(_error_detail(200, url, body))
    data = _normalize_purchase_result(data)
    message = _purchase_error(data)
    if message:
        raise BitcoinPostageError(f"Bitcoin Postage: {message}")
    return data


def _first_item(result: dict) -> dict:
    result = _normalize_purchase_result(result)
    items = result.get("items") or result.get("Items") or []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list) or not items or not isinstance(items[0], dict):
        raise BitcoinPostageError("Bitcoin Postage did not return a label item.")
    return items[0]


def _label_url(item: dict) -> str:
    for key in ("filename", "label_url", "url", "pdf", "labelUrl", "label"):
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

    sender = _default_sender()
    carrier = _option(options, "carrier", default="usps").lower()
    package_type = _option(
        options, "packageType", "package_type", "packagetype_usps", default="USPScustom"
    )
    if package_type in FLAT_RATE_TYPES:
        service = "Priority"
        dims = _flat_rate_dimensions(package_type)
        width, height, depth = dims["width"], dims["height"], dims["depth"]
    else:
        service = _option(
            options,
            "service",
            default="GroundAdvantage" if carrier == "usps" else "",
        )
        width = _option(options, "width", "input_width")
        height = _option(options, "height", "input_height")
        depth = _option(options, "length", "input_length", "depth")
    lbs, oz = _split_weight(options)
    if lbs * 16 + float(oz or 0) <= 0:
        raise BitcoinPostageError("Enter a package weight (lbs and/or oz).")

    from_name = _option(options, "fromName", "from_name", default=sender.from_name if sender else "")
    from_street = _option(
        options, "fromStreet", "from_street", default=sender.from_street if sender else ""
    )
    from_city = _option(options, "fromCity", "from_city", default=sender.from_city if sender else "")
    from_state = _option(
        options, "fromState", "from_state", default=sender.from_state if sender else ""
    )
    from_zip = _option(options, "fromZip", "from_zip", default=sender.from_zip if sender else "")
    from_country = _option(
        options,
        "fromCountry",
        "from_country",
        default=(sender.from_country if sender and sender.from_country else "US"),
    )
    missing = [
        name
        for name, value in (
            ("from_name", from_name),
            ("from_street", from_street),
            ("from_city", from_city),
            ("from_state", from_state),
            ("from_zip", from_zip),
        )
        if not value
    ]
    if missing:
        raise BitcoinPostageError(
            "Fill the Bitcoin Postage sender address (name, street, city, state, ZIP) before creating a label."
        )

    form = {
        **_auth_form(),
        "order_id": order.order_number or str(order.id),
        "redirect": "",
        "service": service,
        "carrier": carrier,
        "from_name": from_name,
        "from_street": from_street,
        "from_apt": _option(
            options, "fromApt", "from_apt", default=sender.from_apt if sender else ""
        ),
        "from_city": from_city,
        "from_state": from_state,
        "from_zip": from_zip,
        "from_country": from_country or "US",
        "from_phone": _option(
            options, "fromPhone", "from_phone", default=sender.from_phone if sender else ""
        ),
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
        "weight_lbs": str(lbs),
        "weight_oz": oz,
        "width": width,
        "height": height,
        "depth": depth,
        "package_type": _api_package_type(package_type),
        "label_format": _option(options, "labelFormat", "label_format", default="PDF").upper()
        or "PDF",
    }
    if carrier == "usps":
        form["packagetype_usps"] = package_type
        if _truthy(options.get("testMode")) or _truthy(options.get("test_mode")):
            form["test_mode"] = "true"
    elif carrier == "fedex":
        form["packagetype_fedex"] = package_type
    elif carrier == "canadapost":
        form["packagetype_canadapost"] = package_type

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
    order.status = Order.Status.SHIPPED
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
