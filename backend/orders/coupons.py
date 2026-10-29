from __future__ import annotations

from datetime import datetime

from django.db.models import F, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_naive, make_aware

from orders.models import Coupon, Order

# Orders in these statuses do not count toward usage limits (GreatLife-aligned).
USAGE_EXCLUDED_STATUSES = (
    Order.Status.CANCELLED,
    Order.Status.FAILED,
    Order.Status.REFUNDED,
)


def serialize_coupon(coupon: Coupon) -> dict:
    partner_ids = normalized_id_list(coupon.stackable_coupon_ids)
    partners = []
    if partner_ids:
        for row in Coupon.objects.filter(pk__in=partner_ids).only("id", "code", "name"):
            partners.append({"id": str(row.id), "code": row.code, "name": row.name})
    return {
        "id": str(coupon.id),
        "code": coupon.code,
        "name": coupon.name,
        "discountType": coupon.discount_type,
        "amount": coupon.amount,
        "minimumAmount": coupon.minimum_amount,
        "usageLimit": coupon.usage_limit,
        "usageLimitPerUser": coupon.usage_limit_per_user,
        "usedCount": coupon.used_count,
        "stackableWithOtherCoupons": bool(coupon.stackable_with_other_coupons),
        "stackableCouponIds": partner_ids,
        "stackablePartners": partners,
        "startsAt": coupon.starts_at.isoformat() if coupon.starts_at else None,
        "expiresAt": coupon.expires_at.isoformat() if coupon.expires_at else None,
        "isActive": coupon.is_active,
        "createdAt": coupon.created_at.isoformat() if coupon.created_at else None,
    }


def normalized_id_list(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        return [raw.strip()] if raw.strip() else []
    out: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if text and text not in out:
            out.append(text)
    return out


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


def order_uses_coupon_q(coupon: Coupon) -> Q:
    code = (coupon.code or "").strip()
    q = Q(coupon=coupon)
    if code:
        q |= Q(coupon_code__iexact=code)
        q |= Q(coupon_code__istartswith=f"{code},")
        q |= Q(coupon_code__iendswith=f",{code}")
        q |= Q(coupon_code__icontains=f",{code},")
    return q


def customer_usage_count(
    coupon: Coupon,
    *,
    user=None,
    email: str | None = None,
) -> int:
    qs = Order.objects.exclude(status__in=USAGE_EXCLUDED_STATUSES).filter(
        order_uses_coupon_q(coupon)
    )
    clauses = Q()
    if user is not None and getattr(user, "is_authenticated", False):
        clauses |= Q(user=user)
        user_email = (getattr(user, "email", None) or "").strip()
        if user_email:
            clauses |= Q(customer_email__iexact=user_email)
    email_clean = (email or "").strip()
    if email_clean:
        clauses |= Q(customer_email__iexact=email_clean)
    if not clauses:
        return 0
    return qs.filter(clauses).count()


def can_stack_with(left: Coupon, right: Coupon) -> bool:
    """GreatLife canStackWith: both must allow stacking; partner lists must agree."""
    if str(left.id) == str(right.id):
        return False
    if not left.stackable_with_other_coupons or not right.stackable_with_other_coupons:
        return False
    my_allow = normalized_id_list(left.stackable_coupon_ids)
    their_allow = normalized_id_list(right.stackable_coupon_ids)
    right_id = str(right.id)
    left_id = str(left.id)
    if my_allow and right_id not in my_allow:
        return False
    if their_allow and left_id not in their_allow:
        return False
    return True


def resolve_coupon(
    code: str,
    merchandise: float,
    *,
    user=None,
    email: str | None = None,
    other_coupons: list[Coupon] | None = None,
) -> tuple[Coupon | None, str | None]:
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
    if coupon.usage_limit_per_user is not None:
        authenticated = bool(user is not None and getattr(user, "is_authenticated", False))
        email_clean = (email or "").strip() or (
            (getattr(user, "email", None) or "").strip() if authenticated else ""
        )
        if not authenticated and not email_clean:
            return None, "Sign in or enter your email to use this coupon."
        used = customer_usage_count(coupon, user=user, email=email_clean or None)
        if used >= int(coupon.usage_limit_per_user):
            return None, "You have already used this coupon the maximum number of times."
    minimum = float(coupon.minimum_amount or 0)
    if minimum > 0 and float(merchandise) < minimum:
        return None, f"This coupon requires a ${minimum:.2f} merchandise minimum."
    for existing in other_coupons or []:
        if str(existing.id) == str(coupon.id):
            return None, f"Coupon \"{coupon.code}\" is already applied."
        if not can_stack_with(coupon, existing):
            return None, f"Coupon \"{coupon.code}\" cannot be combined with \"{existing.code}\"."
    return coupon, None


def normalize_codes(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        parts = [raw]
    elif isinstance(raw, (list, tuple)):
        parts = list(raw)
    else:
        parts = [str(raw)]
    out: list[str] = []
    for part in parts:
        for piece in str(part or "").replace(";", ",").split(","):
            code = piece.strip().upper()
            if code and code not in out:
                out.append(code)
    return out


def resolve_coupon_stack(
    codes,
    merchandise: float,
    *,
    user=None,
    email: str | None = None,
) -> tuple[list[Coupon], float, bool, str | None]:
    """
    Resolve one or more coupon codes with GreatLife-style stacking.
    Returns (coupons, total_discount, free_shipping, error).
    """
    cleaned = normalize_codes(codes)
    if not cleaned:
        return [], 0.0, False, None

    coupons: list[Coupon] = []
    for code in cleaned:
        coupon, error = resolve_coupon(
            code,
            merchandise,
            user=user,
            email=email,
            other_coupons=coupons,
        )
        if error or not coupon:
            return [], 0.0, False, error or "This coupon is not valid."
        coupons.append(coupon)

    remaining = max(0.0, float(merchandise))
    total_discount = 0.0
    free_ship = False
    for coupon in coupons:
        disc = discount_for(coupon, remaining)
        total_discount = round(total_discount + disc, 2)
        remaining = max(0.0, round(remaining - disc, 2))
        if is_free_shipping(coupon):
            free_ship = True
    return coupons, total_discount, free_ship, None


def codes_joined(coupons: list[Coupon]) -> str:
    return ",".join(c.code for c in coupons)


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
    per_user_raw = data.get("usageLimitPerUser", data.get("usage_limit_per_user"))
    usage_limit_per_user = None
    if per_user_raw not in (None, ""):
        try:
            usage_limit_per_user = int(per_user_raw)
        except (TypeError, ValueError):
            return "Per-customer usage limit must be a whole number."
        if usage_limit_per_user < 1:
            return "Per-customer usage limit must be at least 1, or left blank."
    starts_at = parse_optional_datetime(data.get("startsAt") or data.get("starts_at"))
    expires_at = parse_optional_datetime(data.get("expiresAt") or data.get("expires_at"))
    if starts_at and expires_at and expires_at <= starts_at:
        return "Expiration must be after the start date."
    is_active = data.get("isActive")
    if is_active is None:
        is_active = data.get("is_active", True)
    stackable = data.get("stackableWithOtherCoupons")
    if stackable is None:
        stackable = data.get("stackable_with_other_coupons", False)
    partner_raw = data.get("stackableCouponIds", data.get("stackable_coupon_ids"))
    partner_ids = normalized_id_list(partner_raw)
    if partner_ids:
        existing = set(
            str(pk)
            for pk in Coupon.objects.filter(pk__in=partner_ids).values_list("id", flat=True)
        )
        self_id = str(coupon.pk) if coupon.pk else ""
        partner_ids = [pid for pid in partner_ids if pid in existing and pid != self_id]
    coupon.code = code
    coupon.name = name
    coupon.discount_type = discount_type
    coupon.amount = amount
    coupon.minimum_amount = minimum_amount
    coupon.usage_limit = usage_limit
    coupon.usage_limit_per_user = usage_limit_per_user
    coupon.stackable_with_other_coupons = bool(stackable)
    coupon.stackable_coupon_ids = partner_ids if bool(stackable) else []
    coupon.starts_at = starts_at
    coupon.expires_at = expires_at
    coupon.is_active = bool(is_active)
    coupon.save()
    sync_stack_partners(coupon)
    return None


def sync_stack_partners(coupon: Coupon) -> None:
    """Keep partner lists roughly symmetric (GreatLife-style)."""
    self_id = str(coupon.id)
    desired = set(normalized_id_list(coupon.stackable_coupon_ids)) if coupon.stackable_with_other_coupons else set()
    for partner in Coupon.objects.exclude(pk=coupon.pk):
        partner_ids = set(normalized_id_list(partner.stackable_coupon_ids))
        changed = False
        if self_id in desired:
            if not partner.stackable_with_other_coupons:
                partner.stackable_with_other_coupons = True
                changed = True
            if self_id not in partner_ids:
                # Only auto-add when partner uses an explicit list or empty "any" list.
                if partner_ids or not partner.stackable_coupon_ids:
                    partner_ids.add(self_id)
                    partner.stackable_coupon_ids = sorted(partner_ids)
                    changed = True
        else:
            if self_id in partner_ids:
                partner_ids.discard(self_id)
                partner.stackable_coupon_ids = sorted(partner_ids)
                changed = True
        if changed:
            partner.save(update_fields=["stackable_with_other_coupons", "stackable_coupon_ids", "updated_at"])


def bump_usage(coupon: Coupon) -> None:
    Coupon.objects.filter(pk=coupon.pk).update(used_count=F("used_count") + 1)


def bump_usage_many(coupons: list[Coupon]) -> None:
    for coupon in coupons:
        bump_usage(coupon)
