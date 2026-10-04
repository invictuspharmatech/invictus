from datetime import datetime

from django.db.models import F
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_naive, make_aware

from orders.models import Coupon


def serialize_coupon(coupon: Coupon) -> dict:
    return {
        "id": str(coupon.id),
        "code": coupon.code,
        "name": coupon.name,
        "discountType": coupon.discount_type,
        "amount": coupon.amount,
        "minimumAmount": coupon.minimum_amount,
        "usageLimit": coupon.usage_limit,
        "usedCount": coupon.used_count,
        "startsAt": coupon.starts_at.isoformat() if coupon.starts_at else None,
        "expiresAt": coupon.expires_at.isoformat() if coupon.expires_at else None,
        "isActive": coupon.is_active,
        "createdAt": coupon.created_at.isoformat() if coupon.created_at else None,
    }


def parse_optional_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = parse_datetime(text)
        if dt is None:
            return None
    if is_naive(dt):
        dt = make_aware(dt)
    return dt


def discount_for(coupon: Coupon, merchandise: float) -> float:
    kind = coupon.discount_type
    merch = max(0.0, float(merchandise))
    if kind == Coupon.DiscountType.PERCENT:
        return round(min(merch, merch * (float(coupon.amount) / 100.0)), 2)
    if kind == Coupon.DiscountType.FIXED:
        return round(min(merch, float(coupon.amount or 0)), 2)
    if kind == Coupon.DiscountType.FREE_SHIPPING:
        return 0.0
    raise ValueError(f"Unknown coupon type: {kind}")


def is_free_shipping(coupon: Coupon | None) -> bool:
    return bool(coupon and coupon.discount_type == Coupon.DiscountType.FREE_SHIPPING)


def resolve_coupon(code: str, merchandise: float) -> tuple[Coupon | None, str | None]:
    cleaned = (code or "").strip()
    if not cleaned:
        return None, "Enter a coupon code."
    coupon = Coupon.objects.filter(code__iexact=cleaned).first()
    if not coupon or not coupon.is_active:
        return None, "This coupon is not valid."
    now = timezone.now()
    if coupon.starts_at and coupon.starts_at > now:
        return None, "This coupon is not active yet."
    if coupon.expires_at and coupon.expires_at < now:
        return None, "This coupon has expired."
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        return None, "This coupon has reached its usage limit."
    minimum = float(coupon.minimum_amount or 0)
    if minimum > 0 and float(merchandise) < minimum:
        return None, f"This coupon requires a ${minimum:.2f} merchandise minimum."
    return coupon, None


def apply_coupon_fields(coupon: Coupon, data: dict) -> str | None:
    code = (data.get("code") or "").strip().upper()
    name = (data.get("name") or "").strip()
    discount_type = (data.get("discountType") or data.get("discount_type") or "").strip().upper()
    if not code:
        return "Coupon code is required."
    if not name:
        return "Coupon name is required."
    valid = {choice[0] for choice in Coupon.DiscountType.choices}
    if discount_type not in valid:
        return "Choose percent off, a fixed amount, or free shipping."
    if Coupon.objects.filter(code__iexact=code).exclude(pk=coupon.pk).exists():
        return "That coupon code is already in use."
    try:
        amount = float(data.get("amount") or 0)
    except (TypeError, ValueError):
        return "Amount must be a number."
    if discount_type == Coupon.DiscountType.PERCENT and (amount < 0 or amount > 100):
        return "Percent off must be between 0 and 100."
    if discount_type == Coupon.DiscountType.FIXED and amount < 0:
        return "Fixed amount cannot be negative."
    if discount_type == Coupon.DiscountType.FREE_SHIPPING:
        amount = 0
    try:
        minimum_amount = float(data.get("minimumAmount", data.get("minimum_amount")) or 0)
    except (TypeError, ValueError):
        return "Minimum amount must be a number."
    usage_raw = data.get("usageLimit", data.get("usage_limit"))
    usage_limit = None
    if usage_raw not in (None, ""):
        try:
            usage_limit = int(usage_raw)
        except (TypeError, ValueError):
            return "Usage limit must be a whole number."
        if usage_limit < 1:
            return "Usage limit must be at least 1, or left blank."
    starts_at = parse_optional_datetime(data.get("startsAt") or data.get("starts_at"))
    expires_at = parse_optional_datetime(data.get("expiresAt") or data.get("expires_at"))
    if starts_at and expires_at and expires_at <= starts_at:
        return "Expiration must be after the start date."
    is_active = data.get("isActive")
    if is_active is None:
        is_active = data.get("is_active", True)
    coupon.code = code
    coupon.name = name
    coupon.discount_type = discount_type
    coupon.amount = amount
    coupon.minimum_amount = minimum_amount
    coupon.usage_limit = usage_limit
    coupon.starts_at = starts_at
    coupon.expires_at = expires_at
    coupon.is_active = bool(is_active)
    coupon.save()
    return None


def bump_usage(coupon: Coupon) -> None:
    Coupon.objects.filter(pk=coupon.pk).update(used_count=F("used_count") + 1)
