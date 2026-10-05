"""Customer-facing money math, matching Great Life checkout/analytics.

Great Life charges one order:
  total_amount = subtotal + shipping - discounts
  merchandise  = total_amount - shipping  (never below zero)
  invoice      = total_amount

Warehouse splits are fulfillment-only. Shipping is charged once per customer
order, not per warehouse row.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

USD = Decimal("0.01")


def money(value) -> float:
    try:
        amount = Decimal(str(value if value is not None else 0))
    except Exception:
        amount = Decimal("0")
    return float(amount.quantize(USD, rounding=ROUND_HALF_UP))


def selling_triplet(grand_total, shipping_total) -> dict[str, float]:
    """Great Life analytics: merch = paid total minus shipping actually collected."""
    grand = money(grand_total)
    shipping = money(min(max(money(shipping_total), 0), max(grand, 0)))
    return {
        "subtotal": money(max(0, grand - shipping)),
        "shipping": shipping,
        "grand_total": grand,
    }


def allocate_weighted(total: float, weights: list[float]) -> list[float]:
    """Split `total` by weights. Last share absorbs remainder so parts sum exactly."""
    amount = money(total)
    if not weights:
        return []
    if len(weights) == 1:
        return [amount]
    raw = [max(0.0, float(weight or 0)) for weight in weights]
    pooled = sum(raw)
    if pooled <= 0:
        zeros = [0.0] * (len(raw) - 1)
        return [*zeros, amount]
    shares: list[float] = []
    remaining = amount
    for index, weight in enumerate(raw):
        if index == len(raw) - 1:
            shares.append(money(remaining))
            continue
        share = money(amount * (weight / pooled))
        shares.append(share)
        remaining = money(remaining - share)
    return shares


def customer_checkout_totals(
    subtotal: float,
    *,
    affiliate_discount_rate: float = 0.0,
    coupon_discount: float = 0.0,
    free_shipping: bool = False,
    shipping_usd: float = 20.0,
) -> dict[str, float | bool]:
    """One customer total: merchandise after discounts + a single shipping charge."""
    cart = money(subtotal)
    affiliate_off = money(cart * float(affiliate_discount_rate or 0)) if affiliate_discount_rate else 0.0
    after_affiliate = money(max(0, cart - affiliate_off))
    coupon_off = money(min(after_affiliate, max(0.0, float(coupon_discount or 0))))
    merchandise = money(max(0, after_affiliate - coupon_off))
    shipping = 0.0 if free_shipping else money(shipping_usd)
    discount_total = money(affiliate_off + coupon_off)
    return {
        "subtotal": cart,
        "affiliate_discount": affiliate_off,
        "coupon_discount": coupon_off,
        "discount_total": discount_total,
        "merchandise": merchandise,
        "shipping": shipping,
        "grand_total": money(merchandise + shipping),
        "shipping_waived": bool(free_shipping),
    }


def affiliate_commission(merchandise: float, *, commission_type: str, rate: float) -> float:
    """Great Life: percentage of merchandise, or a fixed amount capped at merchandise."""
    merch = money(merchandise)
    amount = money(rate)
    if amount <= 0 or merch <= 0:
        return 0.0
    kind = (commission_type or "").strip().upper()
    if kind == "FIXED":
        return money(min(amount, merch))
    return money(merch * min(amount, 100.0) / 100.0)
