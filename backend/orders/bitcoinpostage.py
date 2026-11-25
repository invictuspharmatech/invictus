import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from django.utils import timezone

from orders.models import (
    BitcoinPostageAccount,
    BitcoinPostageSender,
    BitcoinPostageSettings,
    Order,
    ShippingLabel,
)


class BitcoinPostageError(Exception):
    pass


DEFAULT_API_BASE = "https://bitcoinpostage.info/api"
WAREHOUSES = (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2)


def get_settings() -> BitcoinPostageSettings:
    row, _ = BitcoinPostageSettings.objects.get_or_create(pk=1)
    return row


def get_or_create_account(warehouse: str) -> BitcoinPostageAccount:
    code = (warehouse or "").strip().upper()
    if code not in WAREHOUSES:
        raise BitcoinPostageError("Warehouse must be WAREHOUSE_1 or WAREHOUSE_2.")
    row, _ = BitcoinPostageAccount.objects.get_or_create(
        warehouse=code,
        defaults={
            "name": f"Warehouse {code[-1]}",
            "api_url": DEFAULT_API_BASE,
        },
    )
    return row


def ensure_accounts() -> list[BitcoinPostageAccount]:
    return [get_or_create_account(code) for code in WAREHOUSES]
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


def _legacy_credentials() -> dict:
    row = get_settings()
    return {
        "api_url": normalize_api_base(row.api_url),
        "key": (row.api_key or "").strip(),
        "secret": (row.api_secret or "").strip(),
        "warehouse": "",
        "name": "Legacy",
    }


def credentials(warehouse: str | None = None) -> dict:
    """Resolve BTC Postage API credentials for a warehouse (from the order)."""
    code = (warehouse or "").strip().upper()
    if code in WAREHOUSES:
        account = get_or_create_account(code)
        if (account.api_key or "").strip() and (account.api_secret or "").strip():
            return {
                "api_url": normalize_api_base(account.api_url),
                "key": (account.api_key or "").strip(),
                "secret": (account.api_secret or "").strip(),
                "warehouse": code,
                "name": account.name or code,
            }
        # Warehouse account exists but empty → try legacy singleton for that warehouse.
        legacy = _legacy_credentials()
        if legacy["key"] and legacy["secret"]:
            return {**legacy, "warehouse": code}
        return {
            "api_url": normalize_api_base(account.api_url),
            "key": "",
            "secret": "",
            "warehouse": code,
            "name": account.name or code,
        }
    legacy = _legacy_credentials()
    if legacy["key"] and legacy["secret"]:
        return legacy
    for row in BitcoinPostageAccount.objects.all().order_by("warehouse"):
        if (row.api_key or "").strip() and (row.api_secret or "").strip():
            return {
                "api_url": normalize_api_base(row.api_url),
                "key": (row.api_key or "").strip(),
                "secret": (row.api_secret or "").strip(),
                "warehouse": row.warehouse,
                "name": row.name or row.warehouse,
            }
    return legacy


def _auth_form(creds: dict | None = None) -> dict:
    row = creds or credentials()
    return {"key": row["key"], "secret": row["secret"]}


def serialize_account(row: BitcoinPostageAccount) -> dict:
    return {
        "id": str(row.id),
        "warehouse": row.warehouse,
        "warehouseLabel": "Warehouse 1" if row.warehouse == Order.Warehouse.WAREHOUSE_1 else "Warehouse 2",
        "name": row.name or "",
        "apiUrl": row.api_url,
        "apiKey": row.api_key,
        "hasSecret": bool(row.api_secret),
        "isConfigured": bool((row.api_key or "").strip() and (row.api_secret or "").strip()),
    }


def serialize_settings_payload() -> dict:
    accounts = [serialize_account(row) for row in ensure_accounts()]
    return {
        "accounts": accounts,
        # Backward-compatible single-account fields (warehouse 1 preferred).
        "apiUrl": accounts[0]["apiUrl"] if accounts else DEFAULT_API_BASE,
        "apiKey": accounts[0]["apiKey"] if accounts else "",
        "hasSecret": accounts[0]["hasSecret"] if accounts else False,
        "isConfigured": any(row["isConfigured"] for row in accounts),
    }


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
FLAT_RATE_TYPES = frozenset(
    {
        "FlatRateEnvelope",
        "FlatRateLegalEnvelope",
        "FlatRatePaddedEnvelope",
        "SmallFlatRateEnvelope",
        "SmallFlatRateBox",
        "MediumFlatRateBox",
        "LargeFlatRateBox",
    }
)
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
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def _resolve_usps_test_mode(options: dict) -> bool:
    """Match PurePharma: only honor explicit test_mode / testMode flags for USPS."""
    if "test_mode" in options:
        return _truthy(options.get("test_mode"))
    if "testMode" in options:
        return _truthy(options.get("testMode"))
    return False


def _parse_json_payload(text: str) -> Any:
    """Parse BTCPostage JSON (object or rate list). Keep lists intact for get-rates."""
    raw = (text or "").strip()
    if raw.startswith("\ufeff"):
        raw = raw.lstrip("\ufeff")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Purchase responses are objects; tolerate leading/trailing noise.
    start_obj = raw.find("{")
    end_obj = raw.rfind("}")
    if start_obj >= 0 and end_obj > start_obj:
        try:
            return json.loads(raw[start_obj : end_obj + 1])
        except json.JSONDecodeError:
            pass
    start_list = raw.find("[")
    end_list = raw.rfind("]")
    if start_list >= 0 and end_list > start_list:
        try:
            return json.loads(raw[start_list : end_list + 1])
        except json.JSONDecodeError:
            return None
    return None


def _parse_json_object(text: str) -> dict | None:
    data = _parse_json_payload(text)
    if isinstance(data, dict):
        return data
    # Backward-compatible: some purchase replies were wrapped as a one-item list.
    if isinstance(data, list) and data and isinstance(data[0], dict):
        first = data[0]
        if first.get("items") or first.get("Items") or first.get("filename"):
            return first
    return None


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
    if package_type == "LargeFlatRateBox":
        return {"width": "12", "height": "5.5", "depth": "12"}
    if package_type == "SmallFlatRateBox":
        return {"width": "5.375", "height": "1.625", "depth": "8.625"}
    if package_type == "FlatRateLegalEnvelope":
        return {"width": "9.5", "height": "0.75", "depth": "15"}
    # FlatRateEnvelope / padded / small envelope defaults
    return {"width": "9.5", "height": "0.75", "depth": "12.5"}


def _default_sender(warehouse: str | None = None) -> BitcoinPostageSender | None:
    code = (warehouse or "").strip().upper()
    if code in WAREHOUSES:
        match = (
            BitcoinPostageSender.objects.filter(warehouse=code, is_default=True).first()
            or BitcoinPostageSender.objects.filter(warehouse=code).first()
        )
        if match:
            return match
    return (
        BitcoinPostageSender.objects.filter(warehouse="", is_default=True).first()
        or BitcoinPostageSender.objects.filter(is_default=True).first()
        or BitcoinPostageSender.objects.first()
    )


def _post_form(url: str, form: dict) -> Any:
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
    data = _parse_json_payload(body)
    if data is None:
        raise BitcoinPostageError(_error_detail(200, url, body))
    # get-rates returns a bare list of quotes (GreatLife parses JSON.parse(response) as array).
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
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


def get_credits(warehouse: str | None = None) -> dict:
    creds = credentials(warehouse)
    if not creds["key"] or not creds["secret"]:
        raise BitcoinPostageError(
            f"Set the Bitcoin Postage API key and secret for {warehouse or 'this warehouse'} first."
        )
    result = _post_form(f"{creds['api_url']}/get-credits", _auth_form(creds))
    raw = str(result.get("credits") or result.get("Credits") or "")
    try:
        credits = f"{float(raw):.1f}"
    except ValueError:
        credits = raw
    return {"credits": credits, "warehouse": creds.get("warehouse") or warehouse or ""}


def charge_credits(amount: str, currency: str, warehouse: str | None = None) -> dict:
    coin = (currency or "btc").strip().lower()
    if coin not in ("btc", "xmr", "ltc"):
        raise BitcoinPostageError("Currency must be btc, xmr, or ltc.")
    try:
        if float(amount) <= 0:
            raise ValueError
    except (TypeError, ValueError) as exc:
        raise BitcoinPostageError("Amount must be a positive USD number.") from exc
    creds = credentials(warehouse)
    if not creds["key"] or not creds["secret"]:
        raise BitcoinPostageError(
            f"Set the Bitcoin Postage API key and secret for {warehouse or 'this warehouse'} first."
        )
    result = _post_form(
        f"{creds['api_url']}/charge-credits",
        {**_auth_form(creds), "amount": str(amount).strip(), "currency": coin},
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
        "warehouse": creds.get("warehouse") or warehouse or "",
    }


def _build_label_form(
    order: Order,
    options: dict,
    *,
    for_rates: bool = False,
) -> tuple[dict, dict, str, str]:
    """
    Build the GreatLife WooCommerce create-purchase / get-rates form.

    GreatLife always calls get-rates first (service empty), then create-purchase
    with the exact service code returned by a rate. Guessing GroundAdvantage
    against create-purchase is what triggers "No valid price quotes found."
    """
    warehouse = (order.warehouse or "").strip().upper()
    creds = credentials(warehouse)
    if not creds["key"] or not creds["secret"]:
        raise BitcoinPostageError(
            f"Set the Bitcoin Postage API key and secret for {warehouse or 'this order warehouse'} first."
        )

    sender = _default_sender(warehouse)
    carrier = _option(options, "carrier", default="usps").lower() or "usps"
    package_type = _option(
        options, "packageType", "package_type", "packagetype_usps", default="USPScustom"
    )
    if package_type in FLAT_RATE_TYPES:
        # Flat-rate boxes still need Priority in practice; rates will confirm.
        service = _option(options, "service", default="Priority")
        dims = _flat_rate_dimensions(package_type)
        width, height, depth = dims["width"], dims["height"], dims["depth"]
    else:
        # GreatLife get-rates uses empty service; create-purchase requires the chosen rate.
        service = _option(options, "service", default="")
        width = _option(options, "width", "input_width")
        height = _option(options, "height", "input_height")
        depth = _option(options, "length", "input_length", "depth")
    if for_rates:
        service = ""
    elif not service:
        raise BitcoinPostageError(
            "Select a postage rate/service first (same as GreatLife: Get rates → Create label)."
        )

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

    to_name = _option(options, "toName", "to_name", default=order.customer_name)
    to_street = _option(options, "toStreet", "to_street", default=order.shipping_line1)
    to_city = _option(options, "toCity", "to_city", default=order.shipping_city)
    to_state = _option(options, "toState", "to_state", default=order.shipping_state)
    to_zip = _option(options, "toZip", "to_zip", default=order.shipping_postal)
    if not all([to_name, to_street, to_city, to_state, to_zip]):
        raise BitcoinPostageError(
            "Fill the recipient address (name, street, city, state, ZIP) before creating a label."
        )

    from_apt = _option(
        options,
        "fromApt",
        "from_apt",
        "fromStreet2",
        "from_street2",
        default=sender.from_apt if sender else "",
    )
    from_phone = _option(
        options, "fromPhone", "from_phone", default=sender.from_phone if sender else ""
    )
    # GreatLife plugin posts from_apt; API docs also accept from_street2 — send both.
    form = {
        **_auth_form(creds),
        "order_id": order.order_number or str(order.id),
        "redirect": "",
        "service": service,
        "carrier": carrier,
        "from_name": from_name,
        "from_street": from_street,
        "from_apt": from_apt,
        "from_street2": from_apt,
        "from_city": from_city,
        "from_state": from_state,
        "from_zip": from_zip,
        "from_country": from_country or "US",
        "from_phone": from_phone,
        "to_name": to_name,
        "to_street": to_street,
        "to_street2": _option(options, "toStreet2", "to_street2", default=order.shipping_line2),
        "to_city": to_city,
        "to_state": to_state,
        "to_zip": to_zip,
        "to_country": _option(
            options, "toCountry", "to_country", default=order.shipping_country or "US"
        ),
        "to_phone": _option(options, "toPhone", "to_phone"),
        # Required by BTCPostage get-rates / create-purchase docs.
        "to_commercial_address": "true"
        if _truthy(_option(options, "toCommercialAddress", "to_commercial_address", default="false"))
        else "false",
        # Mirror GreatLife input_* → width/height/depth mapping.
        "input_width": width,
        "input_height": height,
        "input_length": depth,
        "input_weight_lbs": str(lbs),
        "input_weight_oz": oz,
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
        # USPS only. API: include test_mode=true to skip credit withdrawal; omit when off.
        # GreatLife/PurePharma send the string "true" (not "1" / not JSON bool on the wire).
        if _resolve_usps_test_mode(options):
            form["test_mode"] = "true"
    elif carrier == "fedex":
        form["packagetype_fedex"] = package_type
    elif carrier == "canadapost":
        form["packagetype_canadapost"] = package_type

    return form, creds, carrier, service


def _normalize_rates_payload(data: Any) -> list[dict]:
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        message = data.get("error") or data.get("message") or data.get("msg")
        if isinstance(message, str) and message.strip():
            raise BitcoinPostageError(message.strip())
        for key in ("rates", "result", "data", "items"):
            nested = data.get(key)
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    return []


def get_rates(order: Order, options: dict) -> list[dict]:
    """GreatLife step 1: POST /api/get-rates with empty service, return quote rows."""
    form, creds, _, _ = _build_label_form(order, options, for_rates=True)
    result = _post_form(f"{creds['api_url']}/get-rates", form)
    rates = _normalize_rates_payload(result)
    if not rates:
        raise BitcoinPostageError(
            "No valid price quotes found. Check carrier/package/service, weight, dimensions, and ZIP codes."
        )
    return [
        {
            "carrier": str(row.get("carrier") or ""),
            "service": str(row.get("service") or ""),
            "serviceDisplay": str(row.get("service_display") or row.get("service") or ""),
            "rate": str(row.get("rate") or ""),
            "currency": str(row.get("currency") or "USD"),
            "estDeliveryDays": str(
                row.get("est_delivery_days") or row.get("estDeliveryDays") or ""
            ),
            "raw": row,
        }
        for row in rates
        if str(row.get("service") or "").strip()
    ]


def create_label(order: Order, options: dict) -> ShippingLabel:
    form, creds, carrier, service = _build_label_form(order, options, for_rates=False)
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
    from orders.complete_on_label import mark_completed_with_tracking, maybe_send_completed_mail

    # GreatLife: label/tracking completion marks the order completed and emails the customer.
    previous = mark_completed_with_tracking(order, tracking=tracking or "")
    maybe_send_completed_mail(order, previous)
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
        "warehouse": row.warehouse or "",
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
