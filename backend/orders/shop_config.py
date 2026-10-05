from __future__ import annotations

import uuid

from django.conf import settings

from cms.ops_settings import get_json, has_key, save_json

CHECKOUT_KEY = "checkout.limits"
SHIPPING_KEY = "shipping.fee_options"
WHOLESALE_KEY = "wholesale.defaults"
AFFILIATE_KEY = "affiliate.defaults"

DEFAULT_SHIPPING_FEES = [
    {"id": "standard", "name": "Standard", "fee": float(settings.SHIPPING_USD), "sortOrder": 0}
]


def get_checkout_limits() -> dict:
    raw = get_json(CHECKOUT_KEY, None)
    if not isinstance(raw, dict):
        raw = {}
    min_amount = _optional_money(raw.get("minOrderAmount", raw.get("min_order_amount", settings.MIN_ORDER_USD)))
    if min_amount is None and not has_key(CHECKOUT_KEY):
        min_amount = float(settings.MIN_ORDER_USD)
    return {
        "minOrderAmount": min_amount,
        "maxOrderAmount": _optional_money(raw.get("maxOrderAmount", raw.get("max_order_amount"))),
        "includeShippingInOrderLimit": bool(
            raw.get("includeShippingInOrderLimit", raw.get("include_shipping_in_order_limit", False))
        ),
    }


def save_checkout_limits(payload: dict) -> dict:
    data = payload or {}
    saved = {
        "minOrderAmount": _optional_money(data.get("minOrderAmount", data.get("min_order_amount"))),
        "maxOrderAmount": _optional_money(data.get("maxOrderAmount", data.get("max_order_amount"))),
        "includeShippingInOrderLimit": bool(
            data.get("includeShippingInOrderLimit", data.get("include_shipping_in_order_limit", False))
        ),
    }
    save_json(CHECKOUT_KEY, saved, "Checkout order limits", "checkout")
    return saved


def get_shipping_fees() -> list[dict]:
    if not has_key(SHIPPING_KEY):
        return [dict(row) for row in DEFAULT_SHIPPING_FEES]
    raw = get_json(SHIPPING_KEY, [])
    return normalize_shipping_fees(raw)


def save_shipping_fees(payload) -> list[dict]:
    rows = normalize_shipping_fees(payload)
    save_json(SHIPPING_KEY, rows, "Checkout shipping fees", "shipping")
    return rows


def normalize_shipping_fees(payload) -> list[dict]:
    rows = payload if isinstance(payload, list) else []
    out = []
    seen = set()
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        fee = _money(row.get("fee"), None)
        if not name or fee is None or fee < 0:
            continue
        fee_id = str(row.get("id") or "").strip() or str(uuid.uuid4())
        if fee_id in seen:
            fee_id = str(uuid.uuid4())
        seen.add(fee_id)
        out.append(
            {
                "id": fee_id,
                "name": name[:80],
                "fee": round(fee, 2),
                "sortOrder": _int(row.get("sortOrder", row.get("sort_order")), index),
            }
        )
    out.sort(key=lambda row: (row["sortOrder"], row["name"]))
    return out


def get_default_shipping_usd() -> float:
    fees = get_shipping_fees()
    if not fees:
        return float(settings.SHIPPING_USD)
    return float(fees[0]["fee"])


def resolve_shipping_option(option_id: str | None) -> dict | None:
    fees = get_shipping_fees()
    if not fees:
        return {
            "id": None,
            "name": "Standard",
            "fee": float(settings.SHIPPING_USD),
        }
    if option_id:
        for row in fees:
            if row["id"] == str(option_id).strip():
                return {"id": row["id"], "name": row["name"], "fee": float(row["fee"])}
        return None
    first = fees[0]
    return {"id": first["id"], "name": first["name"], "fee": float(first["fee"])}


def checkout_limit_error(*, charged_merchandise: float, shipping: float) -> str | None:
    limits = get_checkout_limits()
    amount = max(0.0, float(charged_merchandise or 0))
    if limits["includeShippingInOrderLimit"]:
        amount += float(shipping or 0)
    min_amount = limits["minOrderAmount"]
    max_amount = limits["maxOrderAmount"]
    if min_amount and amount + 1e-9 < min_amount:
        return f"${_fmt(min_amount)} minimum order."
    if max_amount and amount > max_amount + 1e-9:
        return f"${_fmt(max_amount)} maximum order."
    return None


def public_checkout_settings() -> dict:
    limits = get_checkout_limits()
    return {
        **limits,
        "shippingFees": get_shipping_fees(),
    }


def get_wholesale_defaults() -> dict:
    raw = get_json(WHOLESALE_KEY, {}) or {}
    if not isinstance(raw, dict):
        raw = {}
    return {
        "enabled": bool(raw.get("enabled", False)),
        "minMonthlySpend": _money(raw.get("minMonthlySpend", raw.get("min_monthly_spend")), 3000) or 3000,
        "consecutiveMonthsToRevoke": max(
            1, _int(raw.get("consecutiveMonthsToRevoke", raw.get("consecutive_months_to_revoke")), 2)
        ),
        "enforceNoMix": bool(raw.get("enforceNoMix", raw.get("enforce_no_mix", True))),
    }


def save_wholesale_defaults(payload: dict) -> dict:
    data = payload or {}
    saved = {
        "enabled": bool(data.get("enabled", False)),
        "minMonthlySpend": max(
            0.0, _money(data.get("minMonthlySpend", data.get("min_monthly_spend")), 3000) or 0
        ),
        "consecutiveMonthsToRevoke": max(
            1, _int(data.get("consecutiveMonthsToRevoke", data.get("consecutive_months_to_revoke")), 2)
        ),
        "enforceNoMix": bool(data.get("enforceNoMix", data.get("enforce_no_mix", True))),
    }
    save_json(WHOLESALE_KEY, saved, "Wholesale defaults", "accounts")
    return saved


def get_affiliate_defaults() -> dict:
    raw = get_json(AFFILIATE_KEY, {}) or {}
    if not isinstance(raw, dict):
        raw = {}
    payout = str(raw.get("payoutType", raw.get("payout_type", "STORE_CREDIT"))).upper()
    if payout in ("STORE_CREDIT", "STORE-CREDIT"):
        payout = "STORE_CREDIT"
    elif payout in ("COMMISSION",):
        payout = "COMMISSION"
    else:
        payout = "STORE_CREDIT"
    kind = str(raw.get("type", "PERCENT")).upper()
    if kind in ("FIXED",):
        kind = "FIXED"
    elif kind in ("PERCENT", "PERCENTAGE"):
        kind = "PERCENT"
    else:
        kind = "PERCENT"
    amount = _money(raw.get("amount"), 10) or 0
    if kind == "PERCENT":
        amount = min(100.0, max(0.0, amount))
    return {"payoutType": payout, "type": kind, "amount": amount}


def save_affiliate_defaults(payload: dict) -> dict:
    saved = get_affiliate_defaults()
    data = payload or {}
    payout = str(data.get("payoutType", data.get("payout_type", saved["payoutType"]))).upper()
    if payout in ("STORE_CREDIT", "STORE-CREDIT"):
        saved["payoutType"] = "STORE_CREDIT"
    elif payout == "COMMISSION":
        saved["payoutType"] = "COMMISSION"
    kind = str(data.get("type", saved["type"])).upper()
    if kind in ("FIXED",):
        saved["type"] = "FIXED"
    elif kind in ("PERCENT", "PERCENTAGE"):
        saved["type"] = "PERCENT"
    amount = _money(data.get("amount"), saved["amount"])
    if amount is None:
        amount = saved["amount"]
    if saved["type"] == "PERCENT":
        amount = min(100.0, max(0.0, amount))
    else:
        amount = max(0.0, amount)
    saved["amount"] = amount
    save_json(AFFILIATE_KEY, saved, "Affiliate defaults", "accounts")
    return saved


def apply_affiliate_defaults(user) -> None:
    defaults = get_affiliate_defaults()
    from accounts.models import User

    user.payout_type = (
        User.PayoutType.STORE_CREDIT
        if defaults["payoutType"] == "STORE_CREDIT"
        else User.PayoutType.COMMISSION
    )
    user.commission_type = (
        User.CommissionType.FIXED if defaults["type"] == "FIXED" else User.CommissionType.PERCENT
    )
    user.commission_rate = float(defaults["amount"])


def _optional_money(value):
    if value in (None, "", False):
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    return round(amount, 2)


def _money(value, default):
    if value in (None, ""):
        return default
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return default


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _fmt(amount: float) -> str:
    if float(amount).is_integer():
        return str(int(amount))
    return f"{amount:.2f}"
