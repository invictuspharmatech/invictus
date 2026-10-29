from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsStoreStaff
from orders.coupons import (
    apply_coupon_fields,
    normalize_codes,
    resolve_coupon,
    resolve_coupon_stack,
    serialize_coupon,
)
from orders.models import Coupon


@api_view(["POST"])
@permission_classes([AllowAny])
def validate_coupon_view(request):
    """
    Validate one code, optionally against already-applied codes (stacking).
    Body: { code | couponCode, merchandiseTotal, email?, existingCodes? | couponCodes? }
    """
    code = request.data.get("code") or request.data.get("couponCode") or ""
    try:
        merch = float(request.data.get("merchandiseTotal") or 0)
    except (TypeError, ValueError):
        merch = 0
    email = (request.data.get("email") or "").strip() or None
    existing = normalize_codes(
        request.data.get("existingCodes")
        or request.data.get("couponCodes")
        or request.data.get("codes")
        or []
    )
    # When validating a new code, existingCodes are already applied; exclude the new code itself.
    other_codes = [c for c in existing if c.upper() != str(code).strip().upper()]
    other_coupons = []
    for other_code in other_codes:
        other, other_error = resolve_coupon(
            other_code,
            merch,
            user=request.user if request.user.is_authenticated else None,
            email=email,
        )
        if other_error or not other:
            return Response(
                {"error": other_error or f"Applied coupon {other_code} is no longer valid."},
                status=400,
            )
        other_coupons.append(other)

    coupon, error = resolve_coupon(
        code,
        merch,
        user=request.user if request.user.is_authenticated else None,
        email=email,
        other_coupons=other_coupons,
    )
    if error or not coupon:
        return Response({"error": error or "This coupon is not valid."}, status=400)

    stacked = other_coupons + [coupon]
    _, total_discount, free_shipping, stack_error = resolve_coupon_stack(
        [c.code for c in stacked],
        merch,
        user=request.user if request.user.is_authenticated else None,
        email=email,
    )
    if stack_error:
        return Response({"error": stack_error}, status=400)

    return Response(
        {
            "ok": True,
            "code": coupon.code,
            "name": coupon.name,
            "discountType": coupon.discount_type,
            "amount": coupon.amount,
            "discount": total_discount,
            "lineDiscount": None,
            "freeShipping": free_shipping,
            "stackableWithOtherCoupons": bool(coupon.stackable_with_other_coupons),
            "appliedCodes": [c.code for c in stacked],
            "totalDiscount": total_discount,
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_coupon_list(request):
    if request.method == "POST":
        coupon = Coupon()
        error = apply_coupon_fields(coupon, request.data)
        if error:
            return Response({"error": error}, status=400)
        return Response(serialize_coupon(coupon), status=201)
    return Response([serialize_coupon(row) for row in Coupon.objects.all()])


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_coupon_detail(request, pk):
    coupon = Coupon.objects.filter(pk=pk).first()
    if not coupon:
        return Response({"error": "Not found."}, status=404)
    if request.method == "GET":
        return Response(serialize_coupon(coupon))
    if request.method == "DELETE":
        coupon.delete()
        return Response({"ok": True})
    error = apply_coupon_fields(coupon, request.data)
    if error:
        return Response({"error": error}, status=400)
    return Response(serialize_coupon(coupon))
