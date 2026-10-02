from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

from django.db.models import Prefetch, Q
from django.utils import timezone

from accounts.permissions import managed_warehouse
from orders.models import AccountingReset, BtcInvoice, Order, OrderItem

ADMIN_RATE = Decimal("0.25")
PARTY1_OF_TOTAL_AT_FULL_W1 = Decimal("0.60")

TILE_ADMIN = "ADMIN_25"
TILE_PARTY_1 = "PARTY_1"
TILE_PARTY_2 = "PARTY_2"
TILE_KEYS = (TILE_ADMIN, TILE_PARTY_1, TILE_PARTY_2)

TILE_COPY = {
    TILE_ADMIN: (
        "Admin · 25%",
        "25% of proceeds received. Fixed on every sale, regardless of warehouse mix.",
    ),
    TILE_PARTY_1: (
        "Party 1",
        "60% × the W1 merchandise share of each sale, applied to proceeds received.",
    ),
    TILE_PARTY_2: (
        "Party 2",
        "75% minus Party 1's share, so Admin + Party 1 + Party 2 always equals 100%.",
    ),
}

COUNTED_STATUSES = [
    Order.Status.PAID,
    Order.Status.PROCESSING,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
]

USD_CENTS = Decimal("0.01")
CRYPTO_PLACES = Decimal("0.00000001")
PAID_INVOICE_STATUSES = {"paid", "confirmed", "complete", "settled"}


def as_decimal(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def clamp_share(value: Decimal) -> Decimal:
    if value < 0:
        return Decimal("0")
    if value > 1:
        return Decimal("1")
    return value


def w1_merchandise_share(merch_w1: Decimal, merch_w2: Decimal) -> Decimal:
    total = merch_w1 + merch_w2
    if total <= 0:
        return Decimal("0")
    return clamp_share(merch_w1 / total)


def allocate_sale(proceeds: Decimal, w1_share: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """Admin, Party 1, Party 2. Totals exactly `proceeds`."""
    proceeds = as_decimal(proceeds)
    x = clamp_share(as_decimal(w1_share))
    admin = proceeds * ADMIN_RATE
    party1 = proceeds * PARTY1_OF_TOTAL_AT_FULL_W1 * x
    party2 = proceeds - admin - party1
    return admin, party1, party2


def allocate_for_warehouse(
    proceeds: Decimal, w1_share: Decimal, warehouse: str
) -> tuple[Decimal, Decimal, Decimal]:
    x = clamp_share(as_decimal(w1_share))
    proceeds = as_decimal(proceeds)
    if warehouse == Order.Warehouse.WAREHOUSE_1:
        return allocate_sale(proceeds * x, Decimal("1"))
    if warehouse == Order.Warehouse.WAREHOUSE_2:
        return allocate_sale(proceeds * (Decimal("1") - x), Decimal("0"))
    return allocate_sale(proceeds, x)


def quantize_usd(value: Decimal) -> Decimal:
    return as_decimal(value).quantize(USD_CENTS, rounding=ROUND_HALF_UP)


def quantize_crypto(value: Decimal) -> Decimal:
    return as_decimal(value).quantize(CRYPTO_PLACES, rounding=ROUND_HALF_UP)


def money_float(value: Decimal) -> float:
    return float(quantize_usd(value))


def crypto_float(value: Decimal) -> float:
    return float(quantize_crypto(value))


def parse_accounting_warehouse(value: str | None) -> str:
    if value in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2, "BOTH"):
        return value
    return "BOTH"


def resolve_warehouse(user, requested: str | None) -> str:
    locked = managed_warehouse(user)
    if locked in (Order.Warehouse.WAREHOUSE_1, Order.Warehouse.WAREHOUSE_2):
        return locked
    return parse_accounting_warehouse(requested)


def period_window(period: str, now=None):
    now = now or timezone.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "WEEK":
        start = start - timedelta(days=start.weekday())
    elif period == "MONTH":
        start = start.replace(day=1)
    return start


def later(a, b):
    return a if a > b else b


def _item_warehouse(item: OrderItem, order: Order) -> str:
    return item.warehouse or order.warehouse


def _merchandise_split(orders: Iterable[Order]) -> tuple[Decimal, Decimal]:
    w1 = Decimal("0")
    w2 = Decimal("0")
    for order in orders:
        items = list(order.items.all())
        if not items:
            amount = as_decimal(order.merchandise_total)
            if order.warehouse == Order.Warehouse.WAREHOUSE_1:
                w1 += amount
            else:
                w2 += amount
            continue
        for item in items:
            amount = as_decimal(item.line_total)
            if _item_warehouse(item, order) == Order.Warehouse.WAREHOUSE_1:
                w1 += amount
            else:
                w2 += amount
    return w1, w2


def _invoice_crypto(order: Order) -> tuple[Decimal, str | None]:
    invoice = None
    invoices = list(order.btc_invoices.all())
    if invoices:
        invoice = invoices[0]
    if invoice is None:
        return Decimal("0"), None
    status = (invoice.status or "").lower()
    if status not in PAID_INVOICE_STATUSES and order.payment_status != Order.PaymentStatus.PAID:
        if order.status not in COUNTED_STATUSES:
            return Decimal("0"), None
    amount = as_decimal(invoice.crypto_amount)
    code = (invoice.crypto_code or "").strip().upper() or None
    return amount, code


def _sale_from_orders(orders: list[Order]) -> dict:
    merch_w1, merch_w2 = _merchandise_split(orders)
    x = w1_merchandise_share(merch_w1, merch_w2)
    proceeds = sum((as_decimal(order.grand_total) for order in orders), Decimal("0"))
    crypto_total = Decimal("0")
    codes: set[str] = set()
    for order in orders:
        amount, code = _invoice_crypto(order)
        crypto_total += amount
        if code:
            codes.add(code)
    crypto_code = next(iter(codes)) if len(codes) == 1 else None
    if len(codes) > 1:
        crypto_total = Decimal("0")
        crypto_code = None
    return {
        "group_id": orders[0].group_id,
        "order_numbers": [order.order_number for order in orders],
        "w1_share": x,
        "merch_w1": merch_w1,
        "merch_w2": merch_w2,
        "proceeds": proceeds,
        "crypto_proceeds": crypto_total,
        "crypto_code": crypto_code,
    }


def counted_orders_qs(start):
    in_window = Q(paid_at__gte=start) | Q(paid_at__isnull=True, created_at__gte=start)
    return (
        Order.objects.filter(status__in=COUNTED_STATUSES)
        .filter(in_window)
        .prefetch_related(
            "items",
            Prefetch(
                "btc_invoices",
                queryset=BtcInvoice.objects.order_by("-created_at"),
            ),
        )
        .order_by("created_at")
    )


def sales_in_window(start) -> list[dict]:
    groups: dict[str, list[Order]] = defaultdict(list)
    for order in counted_orders_qs(start):
        groups[order.group_id].append(order)
    return [_sale_from_orders(orders) for orders in groups.values()]


def summarize_sales(sales: list[dict], warehouse: str) -> dict:
    proceeds = Decimal("0")
    crypto_proceeds = Decimal("0")
    merch_w1 = Decimal("0")
    merch_w2 = Decimal("0")
    admin = Decimal("0")
    party1 = Decimal("0")
    party2 = Decimal("0")
    crypto_admin = Decimal("0")
    crypto_party1 = Decimal("0")
    crypto_party2 = Decimal("0")
    crypto_codes: set[str] = set()
    rows = []

    for sale in sales:
        merch_w1 += sale["merch_w1"]
        merch_w2 += sale["merch_w2"]
        a, p1, p2 = allocate_for_warehouse(sale["proceeds"], sale["w1_share"], warehouse)
        proceeds += a + p1 + p2
        admin += a
        party1 += p1
        party2 += p2
        ca = cp1 = cp2 = Decimal("0")
        if sale["crypto_proceeds"] > 0:
            ca, cp1, cp2 = allocate_for_warehouse(
                sale["crypto_proceeds"], sale["w1_share"], warehouse
            )
            crypto_proceeds += ca + cp1 + cp2
            crypto_admin += ca
            crypto_party1 += cp1
            crypto_party2 += cp2
            if sale["crypto_code"]:
                crypto_codes.add(sale["crypto_code"])
        rows.append(
            {
                "groupId": sale["group_id"],
                "orderNumbers": sale["order_numbers"],
                "w1Share": float(sale["w1_share"]),
                "proceeds": money_float(a + p1 + p2),
                "admin": money_float(a),
                "party1": money_float(p1),
                "party2": money_float(p2),
                "cryptoProceeds": crypto_float(ca + cp1 + cp2) if sale["crypto_proceeds"] else None,
                "cryptoCode": sale["crypto_code"],
            }
        )

    w1_share = w1_merchandise_share(merch_w1, merch_w2)
    if proceeds <= 0:
        admin_pct = ADMIN_RATE
        party1_pct = PARTY1_OF_TOTAL_AT_FULL_W1 * w1_share
        party2_pct = Decimal("1") - admin_pct - party1_pct
    else:
        admin_pct = admin / proceeds
        party1_pct = party1 / proceeds
        party2_pct = party2 / proceeds

    crypto_code = next(iter(crypto_codes)) if len(crypto_codes) == 1 else None
    amounts = {
        TILE_ADMIN: admin,
        TILE_PARTY_1: party1,
        TILE_PARTY_2: party2,
    }
    crypto_amounts = {
        TILE_ADMIN: crypto_admin,
        TILE_PARTY_1: crypto_party1,
        TILE_PARTY_2: crypto_party2,
    }
    percents = {
        TILE_ADMIN: admin_pct,
        TILE_PARTY_1: party1_pct,
        TILE_PARTY_2: party2_pct,
    }
    return {
        "proceeds": proceeds,
        "crypto_proceeds": crypto_proceeds,
        "crypto_code": crypto_code,
        "w1_share": w1_share,
        "merch_w1_share": w1_share,
        "amounts": amounts,
        "crypto_amounts": crypto_amounts,
        "percents": percents,
        "sales": rows,
        "check": admin + party1 + party2,
    }


def build_accounting_payload(
    period: str, warehouse: str, tile_starts: dict[str, object], window_start
) -> dict:
    tiles = []
    summary = summarize_sales(sales_in_window(window_start), warehouse)
    unique_starts = {
        start: summarize_sales(sales_in_window(start), warehouse) for start in set(tile_starts.values())
    }
    for key in TILE_KEYS:
        title, description = TILE_COPY[key]
        start = tile_starts[key]
        data = unique_starts[start]
        crypto_amount = data["crypto_amounts"][key]
        tiles.append(
            {
                "key": key,
                "title": title,
                "description": description,
                "amount": money_float(data["amounts"][key]),
                "cryptoAmount": crypto_float(crypto_amount) if data["crypto_proceeds"] else None,
                "cryptoCode": data["crypto_code"],
                "percentOfSale": float((data["percents"][key] * 100).quantize(Decimal("0.01"))),
                "resetAt": None,
            }
        )
    return {
        "period": period,
        "warehouse": warehouse,
        "summary": {
            "proceeds": money_float(summary["proceeds"]),
            "cryptoProceeds": crypto_float(summary["crypto_proceeds"])
            if summary["crypto_proceeds"]
            else None,
            "cryptoCode": summary["crypto_code"],
            "w1Share": float(summary["merch_w1_share"]),
            "allocated": money_float(summary["check"]),
        },
        "tiles": tiles,
        "sales": summary["sales"],
    }


def accounting_response(user, period: str, warehouse_param: str | None) -> dict:
    if period not in ("DAY", "WEEK", "MONTH"):
        period = "DAY"
    warehouse = resolve_warehouse(user, warehouse_param)
    window_start = period_window(period)
    resets = {
        row.tile_key: row
        for row in AccountingReset.objects.filter(period=period, warehouse=warehouse)
        if row.tile_key in TILE_KEYS
    }
    tile_starts = {}
    reset_at = {}
    for key in TILE_KEYS:
        reset = resets.get(key)
        tile_starts[key] = later(window_start, reset.reset_at) if reset else window_start
        reset_at[key] = reset.reset_at.isoformat() if reset else None
    payload = build_accounting_payload(period, warehouse, tile_starts, window_start)
    for tile in payload["tiles"]:
        tile["resetAt"] = reset_at[tile["key"]]
    return payload
