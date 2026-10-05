from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsStoreStaff
from cms.dashboard_tiles import catalog, default_layout, get_layout, save_layout
from orders.order_numbers import get_order_numbering, preview_order_number, save_order_numbering
from orders.shop_config import (
    get_affiliate_defaults,
    get_checkout_limits,
    get_shipping_fees,
    get_wholesale_defaults,
    public_checkout_settings,
    save_affiliate_defaults,
    save_checkout_limits,
    save_shipping_fees,
    save_wholesale_defaults,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_checkout_settings_view(request):
    return Response(public_checkout_settings())


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_dashboard_tiles_view(request):
    if request.method == "PUT":
        layout = save_layout(request.data)
        return Response(layout)
    return Response(
        {
            "layout": get_layout(),
            "catalog": catalog(),
            "defaultLayout": default_layout(),
        }
    )


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_ops_settings_view(request):
    if request.method == "GET":
        numbering = get_order_numbering()
        return Response(
            {
                "checkout": get_checkout_limits(),
                "shipping": {"fees": get_shipping_fees()},
                "orderNumbering": {**numbering, "preview": preview_order_number(numbering)},
                "wholesale": get_wholesale_defaults(),
                "affiliate": get_affiliate_defaults(),
            }
        )

    section = str(request.data.get("section") or "").strip()
    data = request.data.get("data") if isinstance(request.data.get("data"), dict) else request.data
    if section == "checkout":
        return Response({"checkout": save_checkout_limits(data)})
    if section == "shipping":
        fees = data.get("fees") if isinstance(data, dict) else None
        if fees is None:
            fees = request.data.get("fees")
        return Response({"shipping": {"fees": save_shipping_fees(fees)}})
    if section == "orderNumbering":
        saved = save_order_numbering(data)
        return Response({"orderNumbering": {**saved, "preview": preview_order_number(saved)}})
    if section == "wholesale":
        return Response({"wholesale": save_wholesale_defaults(data)})
    if section == "affiliate":
        return Response({"affiliate": save_affiliate_defaults(data)})
    return Response({"error": "Unknown settings section."}, status=400)
