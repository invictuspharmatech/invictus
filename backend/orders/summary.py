from __future__ import annotations

from django.db.models import Prefetch

from accounts.permissions import managed_warehouse
from orders.models import Order, OrderItem
from orders.status import statuses_for_tab


def parse_statuses(raw) -> list[str] | None:
    if raw in (None, "", "all"):
        return None
    if isinstance(raw, str):
        values = [part.strip() for part in raw.split(",") if part.strip()]
    elif isinstance(raw, (list, tuple)):
        values = [str(part).strip() for part in raw if str(part).strip()]
    else:
        values = []
    if not values or "all" in [item.lower() for item in values]:
        return None
    mapped: list[str] = []
    for item in values:
        statuses = statuses_for_tab(item)
        if statuses:
            mapped.extend(statuses)
        else:
            mapped.append(item.upper())
    return mapped


def build_summary(request) -> dict:
    qs = Order.objects.prefetch_related(
        Prefetch("items", queryset=OrderItem.objects.all())
    ).order_by("-created_at")
    warehouse = managed_warehouse(request.user)
    requested_warehouse = request.GET.get("warehouse")
    if warehouse:
        qs = qs.filter(warehouse=warehouse)
    elif requested_warehouse in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
        qs = qs.filter(warehouse=requested_warehouse)
    date_from = request.GET.get("dateFrom") or request.GET.get("date_from")
    date_to = request.GET.get("dateTo") or request.GET.get("date_to")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    statuses = parse_statuses(request.GET.getlist("statuses") or request.GET.get("status") or request.GET.get("statuses"))
    if statuses:
        qs = qs.filter(status__in=statuses)
    rows = []
    for order in qs[:500]:
        rows.append(
            {
                "id": str(order.id),
                "orderNumber": order.order_number,
                "customerName": order.customer_name or order.customer_email or "—",
                "status": order.status,
                "createdAt": order.created_at.isoformat() if order.created_at else "",
                "items": [
                    {"productName": item.name, "quantity": item.quantity}
                    for item in order.items.all()
                ],
            }
        )
    return {
        "orders": rows,
        "totalOrders": len(rows),
        "filters": {
            "dateFrom": date_from or "",
            "dateTo": date_to or "",
            "statuses": statuses or [],
        },
    }


def summary_pdf_bytes(payload: dict) -> bytes:
    lines = ["Invictus Pharma — Order Summary", ""]
    filters = payload.get("filters") or {}
    lines.append(
        f"From {filters.get('dateFrom') or '—'} to {filters.get('dateTo') or '—'} · {payload.get('totalOrders') or 0} orders"
    )
    lines.append("")
    for order in payload.get("orders") or []:
        items = ", ".join(
            f"{item.get('productName')} x{item.get('quantity')}" for item in (order.get("items") or [])
        )
        status = str(order.get("status") or "").replace("_", " ").title()
        date = str(order.get("createdAt") or "")[:10]
        lines.append(f"{order.get('orderNumber')}  {order.get('customerName')}  {status}  {date}")
        if items:
            lines.append(f"  {items}")
        lines.append("")
    return _simple_pdf(lines)


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _simple_pdf(lines: list[str]) -> bytes:
    content_lines = ["BT /F1 11 Tf 36 760 Td"]
    y_steps = 0
    for index, line in enumerate(lines):
        safe = _pdf_escape(line[:110] or " ")
        if index == 0:
            content_lines.append(f"({safe}) Tj")
        else:
            content_lines.append(f"0 -14 Td ({safe}) Tj")
        y_steps += 1
        if y_steps > 48:
            content_lines.append("ET")
            content_lines.append("BT /F1 11 Tf 36 760 Td")
            y_steps = 0
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", "replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{index} 0 obj\n".encode())
        out.extend(obj)
        out.extend(b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode())
    out.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(out)
