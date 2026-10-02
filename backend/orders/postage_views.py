from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsPortalStaff, IsStoreStaff, is_full_admin, managed_warehouse
from orders.bitcoinpostage import (
    BitcoinPostageError,
    charge_credits,
    create_label,
    get_credits,
    get_settings,
    serialize_label,
    serialize_sender,
)
from orders.models import BitcoinPostageSender, Order
from orders.serializers import OrderSerializer


def _staff_can_postage(user) -> bool:
    return is_full_admin(user) or managed_warehouse(user) is not None


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def postage_settings_view(request):
    if not _staff_can_postage(request.user):
        return Response({"error": "Forbidden."}, status=403)
    row = get_settings()
    if request.method == "PUT":
        if not is_full_admin(request.user):
            return Response({"error": "Only admins can change postage credentials."}, status=403)
        row.api_url = str(request.data.get("apiUrl") or row.api_url)
        if "apiKey" in request.data:
            row.api_key = str(request.data.get("apiKey") or "")
        if "apiSecret" in request.data:
            secret = str(request.data.get("apiSecret") or "")
            if secret:
                row.api_secret = secret
        row.save()
    return Response(
        {
            "apiUrl": row.api_url,
            "apiKey": row.api_key,
            "hasSecret": bool(row.api_secret),
            "isConfigured": bool(row.api_key and row.api_secret),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsPortalStaff])
def postage_senders_view(request):
    if request.method == "GET":
        return Response([serialize_sender(row) for row in BitcoinPostageSender.objects.all()])
    row = BitcoinPostageSender.objects.create(
        from_name=str(request.data.get("fromName") or ""),
        from_street=str(request.data.get("fromStreet") or ""),
        from_apt=str(request.data.get("fromApt") or ""),
        from_city=str(request.data.get("fromCity") or ""),
        from_state=str(request.data.get("fromState") or ""),
        from_zip=str(request.data.get("fromZip") or ""),
        from_country=str(request.data.get("fromCountry") or "US"),
        from_phone=str(request.data.get("fromPhone") or ""),
        is_default=bool(request.data.get("isDefault")),
    )
    if row.is_default:
        BitcoinPostageSender.objects.exclude(pk=row.pk).update(is_default=False)
    return Response(serialize_sender(row), status=201)


@api_view(["PUT", "DELETE"])
@permission_classes([IsPortalStaff])
def postage_sender_detail_view(request, pk):
    row = BitcoinPostageSender.objects.filter(pk=pk).first()
    if not row:
        return Response({"error": "Not found."}, status=404)
    if request.method == "DELETE":
        row.delete()
        return Response({"ok": True})
    for field, key in [
        ("from_name", "fromName"),
        ("from_street", "fromStreet"),
        ("from_apt", "fromApt"),
        ("from_city", "fromCity"),
        ("from_state", "fromState"),
        ("from_zip", "fromZip"),
        ("from_country", "fromCountry"),
        ("from_phone", "fromPhone"),
    ]:
        if key in request.data:
            setattr(row, field, str(request.data.get(key) or ""))
    if "isDefault" in request.data:
        row.is_default = bool(request.data.get("isDefault"))
    row.save()
    if row.is_default:
        BitcoinPostageSender.objects.exclude(pk=row.pk).update(is_default=False)
    return Response(serialize_sender(row))


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def postage_credits_view(request):
    try:
        return Response(get_credits())
    except BitcoinPostageError as exc:
        return Response({"error": str(exc)}, status=400)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def postage_charge_view(request):
    if not is_full_admin(request.user):
        return Response({"error": "Forbidden."}, status=403)
    try:
        return Response(charge_credits(str(request.data.get("amount") or ""), str(request.data.get("currency") or "btc")))
    except BitcoinPostageError as exc:
        return Response({"error": str(exc)}, status=400)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def postage_create_label_view(request, pk):
    order = Order.objects.filter(pk=pk).first()
    if not order:
        return Response({"error": "Not found."}, status=404)
    warehouse = managed_warehouse(request.user)
    if warehouse and order.warehouse != warehouse:
        return Response({"error": "Not found."}, status=404)
    try:
        label = create_label(order, request.data if isinstance(request.data, dict) else {})
    except BitcoinPostageError as exc:
        return Response({"error": str(exc)}, status=400)
    order = Order.objects.prefetch_related("items", "btc_invoices", "shipping_labels").get(pk=order.pk)
    return Response({"ok": True, "label": serialize_label(label), "order": OrderSerializer(order).data})
