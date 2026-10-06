from __future__ import annotations

from cms.ops_settings import get_json, save_json

LAYOUT_KEY = "dashboard.tiles_layout"

COLOR_MODES = {
    "brand-orange",
    "brand-green",
    "brand-red",
    "primary",
    "info",
    "success",
    "warning",
    "danger",
    "secondary",
    "dark",
    "threshold_sales",
    "threshold_low_stock",
    "threshold_out_of_stock",
    "threshold_shipping",
}

DYNAMIC_COLORS = {
    "threshold_sales",
    "threshold_low_stock",
    "threshold_out_of_stock",
    "threshold_shipping",
}


def catalog() -> list[dict]:
    return [
        _metric(
            "orders_failed",
            "Failed Orders",
            "Orders",
            "ordersFailed",
            "count",
            "/admin/orders?status=failed",
            "Failed status · live count",
        ),
        _metric(
            "orders_pending",
            "Pending Orders",
            "Orders",
            "ordersPending",
            "count",
            "/admin/orders?status=pending",
            "Awaiting payment · live count",
        ),
        _metric(
            "orders_processing",
            "Processing Orders",
            "Orders",
            "ordersProcessing",
            "count",
            "/admin/orders?status=processing",
            "Currently processing · live count",
        ),
        _metric(
            "orders_completed_week",
            "Completed Orders (This Week)",
            "Orders",
            "ordersCompleted",
            "count",
            "/admin/orders?status=completed",
            "week",
        ),
        _metric(
            "orders_on_hold",
            "Orders On Hold",
            "Orders",
            "ordersOnHold",
            "count",
            "/admin/orders?status=on-hold",
            "On hold · live count",
        ),
        _metric(
            "orders_cancelled",
            "Cancelled Orders",
            "Orders",
            "ordersCancelled",
            "count",
            "/admin/orders?status=cancelled",
            "Cancelled · live count",
        ),
        _metric(
            "orders_refunded",
            "Refunded Orders",
            "Orders",
            "ordersRefunded",
            "count",
            "/admin/orders?status=refunded",
            "Refunded · live count",
        ),
        _metric(
            "orders_partially_filled",
            "Partially Filled Orders",
            "Orders",
            "ordersPartiallyFilled",
            "count",
            "/admin/orders?status=partially-filled",
            "Partially filled · live count",
        ),
        _metric(
            "open_orders",
            "Open Orders",
            "Orders",
            "openOrderCount",
            "count",
            "/admin/orders",
            "Open orders · live count",
        ),
        _metric(
            "customers_total",
            "Customer Accounts",
            "Customers",
            "customersTotal",
            "count",
            "/admin/users",
            "Registered customers · live count",
        ),
        _metric(
            "customers_this_month",
            "New Customers (This Month)",
            "Customers",
            "customersThisMonth",
            "count",
            "/admin/users",
            "month",
        ),
        _metric(
            "pending_affiliates",
            "Pending Affiliates",
            "Customers",
            "pendingAffiliates",
            "count",
            "/admin/affiliates",
            "Applications awaiting review",
        ),
        _metric(
            "shipping_since_reset",
            "Shipping Collected",
            "Revenue",
            "shippingSinceReset",
            "currency",
            "/admin/accounting",
            "Since last reset · revenue eligible",
            supports_dynamic=True,
            icon="truck",
            footer_label="Reset shipping collected",
            kind="shipping_reset",
        ),
        _metric(
            "shipping_this_week",
            "Shipping This Week",
            "Revenue",
            "shippingThisWeek",
            "currency",
            "/admin/accounting",
            "week",
            supports_dynamic=True,
        ),
        _metric(
            "sales_today",
            "Today's Sales",
            "Revenue",
            "salesToday",
            "currency",
            "/admin/analytics",
            "today",
            supports_dynamic=True,
        ),
        _metric(
            "sales_this_week",
            "Sales This Week",
            "Revenue",
            "salesThisWeek",
            "currency",
            "/admin/analytics",
            "week",
            supports_dynamic=True,
        ),
        _metric(
            "sales_this_month",
            "Sales This Month",
            "Revenue",
            "salesThisMonth",
            "currency",
            "/admin/analytics",
            "month",
            supports_dynamic=True,
        ),
        _metric(
            "sales_this_year",
            "Sales This Year",
            "Revenue",
            "salesThisYear",
            "currency",
            "/admin/analytics",
            "Calendar year · revenue eligible",
            supports_dynamic=True,
        ),
        _metric(
            "products_low_stock",
            "Low Stock Products",
            "Catalog",
            "lowStockCount",
            "count",
            "/admin/inventory",
            "Stock 1–10 · live count",
            supports_dynamic=True,
        ),
        _metric(
            "products_out_of_stock",
            "Out of Stock Products",
            "Catalog",
            "outOfStockCount",
            "count",
            "/admin/inventory",
            "Qty 0 or out of stock · live count",
            supports_dynamic=True,
        ),
        _metric(
            "products_total",
            "Products",
            "Catalog",
            "productCount",
            "count",
            "/admin/products",
            "All products · live count",
            icon="package",
            kind="products_breakdown",
        ),
        _metric(
            "top_category_month",
            "Top Category (This Month)",
            "Catalog",
            "topCategoryMonthRevenue",
            "currency",
            "/admin/analytics/categories",
            "month",
            icon="layers",
            kind="top_category",
        ),
        _metric(
            "products_active",
            "Published Products",
            "Catalog",
            "productsActive",
            "count",
            "/admin/products",
            "Status publish · live count",
        ),
        _metric(
            "categories_total",
            "Categories",
            "Catalog",
            "categoriesTotal",
            "count",
            "/admin/categories",
            "Live count",
        ),
        _metric(
            "warehouses_total",
            "Warehouses",
            "Catalog",
            "warehousesTotal",
            "count",
            "/admin/warehouses",
            "Live count",
        ),
        _metric(
            "coupons_total",
            "Coupons",
            "Promotions",
            "couponsTotal",
            "count",
            "/admin/promotions/coupons",
            "Live count",
        ),
        _metric(
            "gift_cards_total",
            "Gift Cards",
            "Promotions",
            "giftCardsTotal",
            "count",
            "/admin",
            "Not enabled on this store",
        ),
        _metric(
            "store_credit_available",
            "Store Credit Available",
            "Promotions",
            "storeCreditAvailable",
            "currency",
            "/admin",
            "Not enabled on this store",
        ),
    ]


def default_layout() -> dict:
    return {
        "tiles": [
            _tile("orders_failed", 1, 0, "danger"),
            _tile("orders_processing", 1, 1, "brand-orange"),
            _tile("orders_completed_week", 1, 2, "brand-orange"),
            _tile("customers_total", 1, 3, "primary"),
            _tile("shipping_since_reset", 2, 0, "threshold_shipping"),
            _tile("sales_today", 2, 1, "threshold_sales"),
            _tile("sales_this_week", 2, 2, "threshold_sales"),
            _tile("sales_this_month", 2, 3, "threshold_sales"),
            _tile("products_low_stock", 3, 0, "threshold_low_stock"),
            _tile("products_out_of_stock", 3, 1, "threshold_out_of_stock"),
        ]
    }


def resolve_tiles(overview: dict) -> list[dict]:
    layout = get_layout()
    catalog_by_id = {entry["id"]: entry for entry in catalog()}
    items = []
    for tile in sorted(layout["tiles"], key=lambda row: (row["row"], row["sort"])):
        if not tile.get("enabled", True):
            continue
        entry = catalog_by_id.get(tile["id"])
        if not entry:
            continue
        value = overview.get(entry["valuePath"], 0)
        extra_label = ""
        badges: list[dict] = []
        kind = entry.get("kind") or "link"
        if kind == "top_category":
            extra_label = str(
                overview.get("topCategoryMonthName")
                or (overview.get("topCategoryMonth") or {}).get("name")
                or "—"
            )
            value = overview.get("topCategoryMonthRevenue", 0)
        if kind == "products_breakdown":
            active = int(overview.get("productsActive") or 0)
            total = int(overview.get("productCount") or 0)
            badges = [
                {"text": f"Active: {active}"},
                {"text": f"Inactive: {max(total - active, 0)}"},
            ]
        items.append(
            {
                "id": tile["id"],
                "row": tile["row"],
                "sort": tile["sort"],
                "color": tile["color"],
                "colSpan": tile["colSpan"],
                "label": tile.get("label") or entry["label"],
                "value": 0 if value is None else value,
                "format": entry["format"],
                "href": entry["footerHref"],
                "periodHint": entry["periodHint"],
                "supportsDynamicColor": bool(entry.get("supportsDynamicColor")),
                "icon": entry.get("icon") or "",
                "footerLabel": entry.get("footerLabel") or "More info",
                "kind": entry.get("kind") or "link",
                "extraLabel": extra_label,
                "badges": badges,
            }
        )
    return items


def get_layout() -> dict:
    raw = get_json(LAYOUT_KEY, None)
    if not isinstance(raw, dict) or not isinstance(raw.get("tiles"), list) or not raw["tiles"]:
        return default_layout()
    return normalize_layout(raw)


def save_layout(payload) -> dict:
    layout = normalize_layout(payload)
    save_json(LAYOUT_KEY, layout, "Dashboard tile layout", "dashboard")
    return layout


def normalize_layout(payload) -> dict:
    catalog_by_id = {entry["id"]: entry for entry in catalog()}
    tiles = []
    seen = set()
    raw_tiles = []
    if isinstance(payload, dict):
        raw_tiles = payload.get("tiles") or []
    elif isinstance(payload, list):
        raw_tiles = payload
    for item in raw_tiles:
        if not isinstance(item, dict):
            continue
        tile_id = str(item.get("id") or "").strip()
        if tile_id not in catalog_by_id or tile_id in seen:
            continue
        seen.add(tile_id)
        color = str(item.get("color") or "brand-orange")
        if color not in COLOR_MODES:
            color = "brand-orange"
        entry = catalog_by_id[tile_id]
        if color in DYNAMIC_COLORS and not entry.get("supportsDynamicColor"):
            color = "brand-orange"
        label = item.get("label")
        if isinstance(label, str):
            label = label.strip() or None
        else:
            label = None
        col_span = item.get("colSpan", item.get("col_span", 1))
        tiles.append(
            {
                "id": tile_id,
                "row": max(1, min(20, _int(item.get("row"), 1))),
                "sort": max(0, min(100, _int(item.get("sort"), 0))),
                "color": color,
                "enabled": bool(item.get("enabled", True)),
                "colSpan": 2 if _int(col_span, 1) == 2 else 1,
                "label": label,
            }
        )
    return {"tiles": tiles}


def default_color_for(tile_id: str) -> str:
    entry = next((row for row in catalog() if row["id"] == tile_id), None)
    if entry and entry.get("supportsDynamicColor"):
        if "out_of_stock" in tile_id:
            return "threshold_out_of_stock"
        if "low_stock" in tile_id or "stock" in tile_id:
            return "threshold_low_stock"
        if "shipping" in tile_id:
            return "threshold_shipping"
        if tile_id.startswith("sales_"):
            return "threshold_sales"
    if "failed" in tile_id:
        return "danger"
    return "brand-orange"


def _metric(
    tile_id: str,
    label: str,
    group: str,
    value_path: str,
    fmt: str,
    href: str,
    hint: str,
    supports_dynamic: bool = False,
    icon: str = "",
    footer_label: str = "More info",
    kind: str = "link",
) -> dict:
    return {
        "id": tile_id,
        "label": label,
        "group": group,
        "valuePath": value_path,
        "format": fmt,
        "footerHref": href,
        "periodHint": hint,
        "supportsDynamicColor": supports_dynamic,
        "icon": icon,
        "footerLabel": footer_label,
        "kind": kind,
    }


def _tile(tile_id: str, row: int, sort: int, color: str) -> dict:
    return {
        "id": tile_id,
        "row": row,
        "sort": sort,
        "color": color,
        "enabled": True,
        "colSpan": 1,
        "label": None,
    }


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
