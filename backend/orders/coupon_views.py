from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsStoreStaff
from orders.coupons import (
    apply_coupon_fields,
    discount_for,
    is_free_shipping,
    resolve_coupon,
    serialize_coupon,
)
from orders.models import Coupon


@api_view(["POST"])
@permission_classes([AllowAny])
def validate_coupon_view(request):
    code = request.data.get("code") or request.data.get("couponCode") or ""
    try:
        merch = float(request.data.get("merchandiseTotal") or 0)
    except (TypeError, ValueError):
        merch = 0
    coupon, error = resolve_coupon(code, merch)
    if error or not coupon:
        return Response({"error": error or "This coupon is not valid."}, status=400)
    return Response(
        {
            "ok": True,
            "code": coupon.code,
            "name": coupon.name,
            "discountType": coupon.discount_type,
            "amount": coupon.amount,
            "discount": discount_for(coupon, merch),
            "freeShipping": is_free_shipping(coupon),
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
