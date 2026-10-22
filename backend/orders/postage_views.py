from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsPortalStaff, IsStoreStaff, is_full_admin, managed_warehouse
from orders.bitcoinpostage import (
    BitcoinPostageError,
    charge_credits,
    create_label,
    ensure_accounts,
    get_credits,
    get_or_create_account,
    normalize_api_base,
    serialize_label,
    serialize_sender,
    serialize_settings_payload,
)
from orders.models import BitcoinPostageSender, Order
from orders.serializers import OrderSerializer


def _staff_can_postage(user) -> bool:
    return is_full_admin(user) or managed_warehouse(user) is not None


def _warehouse_param(request) -> str:
    return str(
        request.GET.get("warehouse")
        or request.data.get("warehouse")
        or ""
    ).strip().upper()


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def postage_settings_view(request):
    if not _staff_can_postage(request.user):
        return Response({"error": "Forbidden."}, status=403)
    ensure_accounts()
    if request.method == "PUT":
        if not is_full_admin(request.user):
            return Response({"error": "Only admins can change postage credentials."}, status=403)
        data = request.data if isinstance(request.data, dict) else {}
        # Prefer explicit per-warehouse account payload.
        accounts_payload = data.get("accounts")
        if isinstance(accounts_payload, list) and accounts_payload:
            for item in accounts_payload:
                if not isinstance(item, dict):
                    continue
                warehouse = str(item.get("warehouse") or "").strip().upper()
                if warehouse not in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
                    continue
                row = get_or_create_account(warehouse)
                if "name" in item:
                    row.name = str(item.get("name") or "")[:120]
                if "apiUrl" in item or "api_url" in item:
                    row.api_url = normalize_api_base(
                        str(item.get("apiUrl") or item.get("api_url") or row.api_url)
                    )
                if "apiKey" in item or "api_key" in item:
                    row.api_key = str(item.get("apiKey") or item.get("api_key") or "")
                secret = item.get("apiSecret") if "apiSecret" in item else item.get("api_secret")
                if secret:
                    row.api_secret = str(secret)
                row.save()
        else:
            warehouse = str(data.get("warehouse") or Order.Warehouse.WAREHOUSE_1).strip().upper()
            if warehouse not in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
                return Response({"error": "warehouse must be WAREHOUSE_1 or WAREHOUSE_2."}, status=400)
            row = get_or_create_account(warehouse)
            if "name" in data:
                row.name = str(data.get("name") or "")[:120]
            row.api_url = normalize_api_base(str(data.get("apiUrl") or row.api_url))
            if "apiKey" in data:
                row.api_key = str(data.get("apiKey") or "")
            if "apiSecret" in data:
                secret = str(data.get("apiSecret") or "")
                if secret:
                    row.api_secret = secret
            row.save()
    return Response(serialize_settings_payload())


@api_view(["GET", "POST"])
@permission_classes([IsPortalStaff])
def postage_senders_view(request):
    if request.method == "GET":
        return Response([serialize_sender(row) for row in BitcoinPostageSender.objects.all()])
    warehouse = str(request.data.get("warehouse") or "").strip().upper()
    if warehouse and warehouse not in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
        return Response({"error": "warehouse must be WAREHOUSE_1, WAREHOUSE_2, or blank."}, status=400)
    row = BitcoinPostageSender.objects.create(
        warehouse=warehouse,
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
        qs = BitcoinPostageSender.objects.exclude(pk=row.pk)
        if row.warehouse:
            qs = qs.filter(warehouse=row.warehouse)
        qs.update(is_default=False)
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
    if "warehouse" in request.data:
        warehouse = str(request.data.get("warehouse") or "").strip().upper()
        if warehouse and warehouse not in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
            return Response({"error": "warehouse must be WAREHOUSE_1, WAREHOUSE_2, or blank."}, status=400)
        row.warehouse = warehouse
    if "isDefault" in request.data:
        row.is_default = bool(request.data.get("isDefault"))
    row.save()
    if row.is_default:
        qs = BitcoinPostageSender.objects.exclude(pk=row.pk)
        if row.warehouse:
            qs = qs.filter(warehouse=row.warehouse)
        qs.update(is_default=False)
    return Response(serialize_sender(row))


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def postage_credits_view(request):
    warehouse = _warehouse_param(request) or None
    try:
        return Response(get_credits(warehouse))
    except BitcoinPostageError as exc:
        return Response({"error": str(exc)}, status=400)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def postage_charge_view(request):
    if not is_full_admin(request.user):
        return Response({"error": "Forbidden."}, status=403)
    warehouse = _warehouse_param(request) or None
    try:
        return Response(
            charge_credits(
                str(request.data.get("amount") or ""),
                str(request.data.get("currency") or "btc"),
                warehouse,
            )
        )
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


def _order_for_postage(request, pk) -> Order | None:
    order = Order.objects.filter(pk=pk).first()
    if not order:
        return None
    warehouse = managed_warehouse(request.user)
    if warehouse and order.warehouse != warehouse:
        return None
    return order


@api_view(["DELETE"])
@permission_classes([IsPortalStaff])
def postage_delete_label_view(request, pk, label_id):
    order = _order_for_postage(request, pk)
    if not order:
        return Response({"error": "Not found."}, status=404)
    label = order.shipping_labels.filter(pk=label_id).first()
    if not label:
        return Response({"error": "Not found."}, status=404)
    label.delete()
    latest = order.shipping_labels.order_by("-created_at").first()
    order.tracking_number = latest.tracking_number if latest else ""
    order.save(update_fields=["tracking_number", "updated_at"])
    order = Order.objects.prefetch_related("items", "btc_invoices", "shipping_labels").get(pk=order.pk)
    return Response({"ok": True, "order": OrderSerializer(order).data})
