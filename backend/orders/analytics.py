from calendar import monthrange
from datetime import datetime, timedelta
from typing import Any

from django.core.exceptions import ValidationError
from django.db.models import Count, Min, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek, TruncYear
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounts.models import User
from catalog.models import Category, Product, ProductCategory
from orders.models import Coupon, Order, OrderItem

PAID_LIKE = [
    Order.Status.PAID,
    Order.Status.PROCESSING,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
]

LOW_STOCK_THRESHOLD = 10
CHART_FORMATS = {
    "day": "%Y-%m-%d",
    "week": "%Y-W%W",
    "month": "%Y-%m",
    "year": "%Y",
}


def _float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _pretty_day(moment: datetime, with_year: bool = True) -> str:
    stamp = moment.strftime("%b %d, %Y" if with_year else "%b %d")
    return stamp.replace(" 0", " ")


def _start_of_day(moment: datetime) -> datetime:
    local = timezone.localtime(moment)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def _end_of_day(moment: datetime) -> datetime:
    return _start_of_day(moment) + timedelta(days=1) - timedelta(microseconds=1)


def _parse_day(raw: Any) -> datetime | None:
    if raw in (None, ""):
        return None
    parsed = parse_date(str(raw))
    if not parsed:
        return None
    return timezone.make_aware(datetime(parsed.year, parsed.month, parsed.day))


def resolve_window(params) -> dict[str, Any]:
    period = str(params.get("period") or "month")
    now = timezone.localtime()
    today = _start_of_day(now)

    if period in ("day", "week", "month", "year"):
        if period == "day":
            start = today
            label = "Today"
        elif period == "week":
            start = today - timedelta(days=today.weekday())
            label = "This week"
        elif period == "year":
            start = today.replace(month=1, day=1)
            label = "This year"
        else:
            start = today.replace(day=1)
            label = "This month"
        return {
            "period": period,
            "chart_period": period,
            "start": start,
            "end": now,
            "label": label,
        }

    custom_type = str(params.get("custom_type") or "range")

    if custom_type == "day":
        day = _parse_day(params.get("date")) or today
        start = _start_of_day(day)
        end = _end_of_day(day)
        return {
            "period": "custom",
            "chart_period": "day",
            "start": start,
            "end": end,
            "label": _pretty_day(start),
        }

    if custom_type == "week":
        day = _parse_day(params.get("date")) or today
        start = _start_of_day(day) - timedelta(days=_start_of_day(day).weekday())
        end = start + timedelta(days=7) - timedelta(microseconds=1)
        return {
            "period": "custom",
            "chart_period": "day",
            "start": start,
            "end": end,
            "label": f"{_pretty_day(start, with_year=False)} – {_pretty_day(end)}",
        }

    if custom_type == "month":
        month_raw = str(params.get("month") or now.strftime("%Y-%m"))
        try:
            year_s, month_s = month_raw.split("-")
            year, month = int(year_s), int(month_s)
            start = timezone.make_aware(datetime(year, month, 1))
        except (TypeError, ValueError):
            start = today.replace(day=1)
        last_day = monthrange(start.year, start.month)[1]
        end = timezone.make_aware(datetime(start.year, start.month, last_day, 23, 59, 59))
        return {
            "period": "custom",
            "chart_period": "day",
            "start": start,
            "end": end,
            "label": start.strftime("%B %Y"),
        }

    if custom_type == "year":
        try:
            year = int(params.get("year") or now.year)
        except (TypeError, ValueError):
            year = now.year
        if year < 2000 or year > 2100:
            year = now.year
        start = timezone.make_aware(datetime(year, 1, 1))
        end = timezone.make_aware(datetime(year, 12, 31, 23, 59, 59))
        return {
            "period": "custom",
            "chart_period": "month",
            "start": start,
            "end": end,
            "label": str(year),
        }

    from_day = _parse_day(params.get("from")) or today.replace(day=1)
    to_day = _parse_day(params.get("to")) or now
    start = _start_of_day(from_day)
    end = _end_of_day(to_day)
    if end < start:
        start, end = _start_of_day(to_day), _end_of_day(from_day)
    days = max(1, (end.date() - start.date()).days + 1)
    if days <= 45:
        chart_period = "day"
    elif days <= 400:
        chart_period = "month"
    else:
        chart_period = "year"
    return {
        "period": "custom",
        "chart_period": chart_period,
        "start": start,
        "end": end,
        "label": f"{_pretty_day(start)} – {_pretty_day(end)}",
    }


def _window_meta(window: dict[str, Any]) -> dict[str, Any]:
    return {
        "period": window["period"],
        "chart_period": window["chart_period"],
        "start_date": window["start"].isoformat(),
        "end_date": window["end"].isoformat(),
        "label": window["label"],
    }


def _in_window(qs, start, end):
    return qs.filter(created_at__gte=start, created_at__lte=end)


def paid_orders():
    return Order.objects.filter(status__in=PAID_LIKE)


def all_orders():
    return Order.objects.all()


def _triplet(qs) -> dict[str, float]:
    row = qs.aggregate(
        subtotal=Sum("merchandise_total"),
        shipping=Sum("shipping_total"),
        grand_total=Sum("grand_total"),
    )
    return {
        "subtotal": _float(row["subtotal"]),
        "shipping": _float(row["shipping"]),
        "grand_total": _float(row["grand_total"]),
    }


def _apply_category_to_items(qs, category_id):
    if not category_id:
        return qs
    product_ids = ProductCategory.objects.filter(category_id=category_id).values("product_id")
    return qs.filter(product_id__in=product_ids)


def _resolve_category(params) -> tuple[str | None, str | None]:
    raw = params.get("category_id")
    if raw in (None, "", "all"):
        return None, None
    try:
        category = Category.objects.filter(pk=raw).first()
    except (ValidationError, ValueError, TypeError):
        return None, None
    if not category:
        return None, None
    return str(category.id), category.name


def _truncator(chart_period: str):
    mapping = {
        "day": TruncDate,
        "week": TruncWeek,
        "month": TruncMonth,
        "year": TruncYear,
    }
    fn = mapping.get(chart_period, TruncMonth)
    return fn("created_at")


def _format_bucket(value: Any, chart_period: str) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        fmt = CHART_FORMATS.get(chart_period, "%Y-%m")
        try:
            return value.strftime(fmt)
        except ValueError:
            return value.strftime("%Y-%m-%d")
    return str(value)[:10]


def _revenue_chart(start, end, chart_period: str) -> list[dict[str, Any]]:
    qs = (
        _in_window(paid_orders(), start, end)
        .annotate(bucket=_truncator(chart_period))
        .values("bucket")
        .annotate(
            subtotal=Sum("merchandise_total"),
            shipping=Sum("shipping_total"),
            revenue=Sum("grand_total"),
        )
        .order_by("bucket")
    )
    return [
        {
            "period": _format_bucket(row["bucket"], chart_period),
            "revenue": _float(row["revenue"]),
            "subtotal": _float(row["subtotal"]),
            "shipping": _float(row["shipping"]),
        }
        for row in qs
        if row["bucket"] is not None
    ]


def _orders_chart(start, end, chart_period: str) -> list[dict[str, Any]]:
    qs = (
        _in_window(all_orders(), start, end)
        .annotate(bucket=_truncator(chart_period))
        .values("bucket")
        .annotate(orders=Count("id"))
        .order_by("bucket")
    )
    return [
        {
            "period": _format_bucket(row["bucket"], chart_period),
            "orders": int(row["orders"] or 0),
        }
        for row in qs
        if row["bucket"] is not None
    ]


def _top_products(start, end, limit=10, category_id=None) -> list[dict[str, Any]]:
    qs = OrderItem.objects.filter(
        order__status__in=PAID_LIKE,
        order__created_at__gte=start,
        order__created_at__lte=end,
    )
    qs = _apply_category_to_items(qs, category_id)
    rows = (
        qs.values("product_id", "product__name", "product__sku")
        .annotate(total_sold=Sum("quantity"), total_revenue=Sum("line_total"))
        .order_by("-total_sold")[:limit]
    )
    return [
        {
            "product_id": str(row["product_id"]) if row["product_id"] else None,
            "total_sold": int(row["total_sold"] or 0),
            "total_revenue": _float(row["total_revenue"]),
            "product": {
                "name": row["product__name"] or "Unknown product",
                "sku": row["product__sku"] or "",
            },
        }
        for row in rows
    ]


def _top_categories(start, end, limit=10) -> list[dict[str, Any]]:
    primary = ProductCategory.objects.values("product_id").annotate(category_id=Min("category_id"))
    cat_by_product = {row["product_id"]: row["category_id"] for row in primary}
    names = {cat.id: cat.name for cat in Category.objects.all()}
    qs = (
        OrderItem.objects.filter(
            order__status__in=PAID_LIKE,
            order__created_at__gte=start,
            order__created_at__lte=end,
        )
        .values("product_id")
        .annotate(total_sold=Sum("quantity"), total_revenue=Sum("line_total"))
    )
    buckets: dict[str, dict[str, Any]] = {}
    for row in qs:
        cat_id = cat_by_product.get(row["product_id"])
        key = str(cat_id) if cat_id else "0"
        bucket = buckets.setdefault(
            key,
            {
                "id": key,
                "name": names.get(cat_id, "Uncategorized") if cat_id else "Uncategorized",
                "total_sold": 0,
                "total_revenue": 0.0,
            },
        )
        bucket["total_sold"] += int(row["total_sold"] or 0)
        bucket["total_revenue"] += _float(row["total_revenue"])
    ordered = sorted(buckets.values(), key=lambda item: item["total_sold"], reverse=True)
    return ordered[:limit]


def _summary(start, end) -> dict[str, Any]:
    totals = _triplet(_in_window(paid_orders(), start, end))
    products_sold = (
        OrderItem.objects.filter(
            order__status__in=PAID_LIKE,
            order__created_at__gte=start,
            order__created_at__lte=end,
        ).aggregate(total=Sum("quantity"))["total"]
        or 0
    )
    customers = _in_window(
        User.objects.filter(role=User.Role.CUSTOMER),
        start,
        end,
    ).count()
    return {
        "revenue": totals["grand_total"],
        "grand_total": totals["grand_total"],
        "subtotal": totals["subtotal"],
        "shipping": totals["shipping"],
        "orders": _in_window(all_orders(), start, end).count(),
        "products_sold": int(products_sold),
        "customers": customers,
    }


def _period_breakdown() -> dict[str, dict[str, float]]:
    now = timezone.localtime()
    today = _start_of_day(now)
    yesterday = today - timedelta(days=1)
    this_week = today - timedelta(days=today.weekday())
    last_week = this_week - timedelta(weeks=1)
    this_month = today.replace(day=1)
    if this_month.month == 1:
        last_month = this_month.replace(year=this_month.year - 1, month=12)
    else:
        last_month = this_month.replace(month=this_month.month - 1)
    return {
        "today": _triplet(paid_orders().filter(created_at__gte=today, created_at__lte=now)),
        "yesterday": _triplet(
            paid_orders().filter(created_at__gte=yesterday, created_at__lt=today)
        ),
        "this_week": _triplet(paid_orders().filter(created_at__gte=this_week, created_at__lte=now)),
        "last_week": _triplet(
            paid_orders().filter(created_at__gte=last_week, created_at__lt=this_week)
        ),
        "this_month": _triplet(paid_orders().filter(created_at__gte=this_month, created_at__lte=now)),
        "last_month": _triplet(
            paid_orders().filter(created_at__gte=last_month, created_at__lt=this_month)
        ),
    }


def _average_order_value(start, end) -> float:
    qs = _in_window(paid_orders(), start, end)
    count = qs.count()
    if count == 0:
        return 0.0
    total = qs.aggregate(total=Sum("grand_total"))["total"] or 0
    return _float(total) / count


def _product_price(product: Product) -> float:
    if product.sale_price is not None and product.sale_price > 0:
        return float(product.sale_price)
    return float(product.regular_price or 0)


def overview(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    return {
        **_window_meta(window),
        "summary": _summary(start, end),
        "revenue_chart": _revenue_chart(start, end, window["chart_period"]),
        "orders_chart": _orders_chart(start, end, window["chart_period"]),
        "top_products": _top_products(start, end, 10),
        "top_categories": _top_categories(start, end, 10),
    }


def revenue(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    totals = _triplet(_in_window(paid_orders(), start, end))
    breakdown = _period_breakdown()
    by_status = (
        _in_window(paid_orders(), start, end)
        .values("status")
        .annotate(revenue=Sum("grand_total"))
        .order_by("-revenue")
    )
    return {
        **_window_meta(window),
        "total_revenue": totals["grand_total"],
        "totals": totals,
        "revenue_by_period": {key: value["grand_total"] for key, value in breakdown.items()},
        "revenue_by_period_breakdown": breakdown,
        "revenue_by_status": [
            {"status": row["status"], "revenue": _float(row["revenue"])} for row in by_status
        ],
        "average_order_value": round(_average_order_value(start, end), 2),
        "revenue_chart": _revenue_chart(start, end, window["chart_period"]),
    }


def products(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    category_id, category_name = _resolve_category(params)
    catalog = Product.objects.all()
    if category_id:
        catalog = catalog.filter(categories__id=category_id)
    products_by_category = (
        Category.objects.annotate(products_count=Count("products", distinct=True))
        .order_by("-products_count", "name")
    )
    if category_id:
        products_by_category = products_by_category.filter(pk=category_id)
    revenue_rows = OrderItem.objects.filter(
        order__status__in=PAID_LIKE,
        order__created_at__gte=start,
        order__created_at__lte=end,
    )
    revenue_rows = _apply_category_to_items(revenue_rows, category_id)
    revenue_by_product = (
        revenue_rows.values("product_id", "product__name", "product__sku")
        .annotate(revenue=Sum("line_total"), quantity_sold=Sum("quantity"))
        .order_by("-revenue")[:20]
    )
    return {
        **_window_meta(window),
        "category_id": category_id,
        "category_name": category_name,
        "total_products": catalog.count(),
        "active_products": catalog.filter(status="publish").count(),
        "low_stock_products": catalog.filter(stock_quantity__lte=LOW_STOCK_THRESHOLD).count(),
        "top_selling_products": _top_products(start, end, 20, category_id),
        "products_by_category": [
            {
                "id": str(row.id),
                "name": row.name,
                "products_count": int(row.products_count or 0),
            }
            for row in products_by_category
        ],
        "revenue_by_product": [
            {
                "product_id": str(row["product_id"]) if row["product_id"] else None,
                "revenue": _float(row["revenue"]),
                "quantity_sold": int(row["quantity_sold"] or 0),
                "product": {
                    "name": row["product__name"] or "Unknown product",
                    "sku": row["product__sku"] or "",
                },
            }
            for row in revenue_by_product
        ],
    }


def orders(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    scoped = _in_window(all_orders(), start, end)
    return {
        **_window_meta(window),
        "total_orders": scoped.count(),
        "orders_by_status": [
            {"status": row["status"], "count": int(row["count"] or 0)}
            for row in scoped.values("status").annotate(count=Count("id")).order_by("-count")
        ],
        "orders_by_payment_status": [
            {"payment_status": row["payment_status"], "count": int(row["count"] or 0)}
            for row in scoped.values("payment_status")
            .annotate(count=Count("id"))
            .order_by("-count")
        ],
        "orders_chart": _orders_chart(start, end, window["chart_period"]),
        "average_order_value": round(_average_order_value(start, end), 2),
    }


def variations(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    rows = (
        OrderItem.objects.filter(
            order__status__in=PAID_LIKE,
            order__created_at__gte=start,
            order__created_at__lte=end,
        )
        .values("sku", "name", "product_id")
        .annotate(total_sold=Sum("quantity"), total_revenue=Sum("line_total"))
        .order_by("-total_sold")[:50]
    )
    payload = [
        {
            "sku": row["sku"] or "—",
            "name": row["name"] or "Unknown SKU",
            "product_id": str(row["product_id"]) if row["product_id"] else None,
            "total_sold": int(row["total_sold"] or 0),
            "total_revenue": _float(row["total_revenue"]),
        }
        for row in rows
    ]
    return {
        **_window_meta(window),
        "top_variations": payload[:20],
        "variations_performance": payload,
    }


def categories(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    products_by_category = (
        Category.objects.annotate(products_count=Count("products", distinct=True))
        .order_by("-products_count", "name")
    )
    top = _top_categories(start, end, 20)
    return {
        **_window_meta(window),
        "total_categories": Category.objects.count(),
        "top_categories": top,
        "revenue_by_category": [
            {"id": row["id"], "name": row["name"], "revenue": row["total_revenue"]}
            for row in top
        ],
        "products_by_category": [
            {
                "id": str(row.id),
                "name": row.name,
                "products_count": int(row.products_count or 0),
            }
            for row in products_by_category
        ],
    }


def coupons(params) -> dict[str, Any]:
    window = resolve_window(params)
    start, end = window["start"], window["end"]
    usage_qs = (
        _in_window(paid_orders().exclude(coupon_code=""), start, end)
        .values("coupon_id", "coupon_code")
        .annotate(usage_count=Count("id"), total_discount=Sum("discount_total"))
        .order_by("-usage_count")
    )
    usage = [
        {
            "code": row["coupon_code"] or "—",
            "usage_count": int(row["usage_count"] or 0),
            "total_discount": _float(row["total_discount"]),
        }
        for row in usage_qs
    ]
    discount = (
        _in_window(paid_orders(), start, end).aggregate(total=Sum("discount_total"))["total"] or 0
    )
    return {
        **_window_meta(window),
        "total_coupons": Coupon.objects.count(),
        "active_coupons": Coupon.objects.filter(is_active=True).count(),
        "coupon_usage": usage,
        "top_coupons": usage[:10],
        "discount_amount": _float(discount),
    }


def stock(_params=None) -> dict[str, Any]:
    catalog = Product.objects.all()
    in_stock = catalog.filter(stock_quantity__gt=0).count()
    out_of_stock = catalog.filter(stock_quantity__lte=0).count()
    low = catalog.filter(stock_quantity__gt=0, stock_quantity__lte=LOW_STOCK_THRESHOLD)
    low_list = list(low.prefetch_related("categories")[:20])
    total_value = 0.0
    for product in catalog:
        qty = int(product.stock_quantity or 0)
        total_value += qty * _product_price(product)
    stock_by_category = []
    for category in Category.objects.prefetch_related("products"):
        items = list(category.products.all())
        qty = sum(int(item.stock_quantity or 0) for item in items)
        value = sum(int(item.stock_quantity or 0) * _product_price(item) for item in items)
        stock_by_category.append(
            {
                "id": str(category.id),
                "name": category.name,
                "total_stock": qty,
                "total_value": value,
            }
        )
    stock_by_category.sort(key=lambda row: row["total_stock"], reverse=True)
    return {
        "total_products": catalog.count(),
        "in_stock": in_stock,
        "out_of_stock": out_of_stock,
        "low_stock": low.count(),
        "total_value": total_value,
        "stock_by_category": stock_by_category,
        "low_stock_products": [
            {
                "id": str(product.id),
                "name": product.name,
                "sku": product.sku,
                "stock_quantity": int(product.stock_quantity or 0),
                "stock_quantity_w1": int(product.stock_quantity_w1 or 0),
                "stock_quantity_w2": int(product.stock_quantity_w2 or 0),
                "categories": [{"id": str(cat.id), "name": cat.name} for cat in product.categories.all()],
            }
            for product in low_list
        ],
    }


def _daily_buckets(start: datetime, end: datetime) -> list[dict[str, Any]]:
    rows = (
        paid_orders()
        .filter(created_at__gte=start, created_at__lte=end)
        .annotate(bucket=TruncDate("created_at"))
        .values("bucket")
        .annotate(
            subtotal=Sum("merchandise_total"),
            shipping=Sum("shipping_total"),
            grand_total=Sum("grand_total"),
            orders_count=Count("id"),
        )
    )
    keyed = {}
    for row in rows:
        if row["bucket"] is None:
            continue
        key = row["bucket"].isoformat() if hasattr(row["bucket"], "isoformat") else str(row["bucket"])[:10]
        keyed[key] = row
    out = []
    cursor = _start_of_day(start).date()
    last = _start_of_day(end).date()
    while cursor <= last:
        key = cursor.isoformat()
        row = keyed.get(key)
        out.append(
            {
                "date": key,
                "subtotal": _float(row["subtotal"]) if row else 0.0,
                "shipping": _float(row["shipping"]) if row else 0.0,
                "grand_total": _float(row["grand_total"]) if row else 0.0,
                "orders_count": int(row["orders_count"] or 0) if row else 0,
            }
        )
        cursor += timedelta(days=1)
    return out


def sales_charts(params) -> tuple[dict[str, Any] | None, str | None]:
    view = str(params.get("view") or "daily")
    now = timezone.localtime()
    today = _start_of_day(now)

    if view == "daily":
        to_day = _parse_day(params.get("to")) or today
        default_from = to_day - timedelta(days=89)
        from_day = _parse_day(params.get("from")) or default_from
        start = _start_of_day(from_day)
        end = _end_of_day(to_day)
        if start > end:
            return None, "`from` must be on or before `to`."
        if (end.date() - start.date()).days > 400:
            return None, "Date range too large (max 400 days)."
        return {
            "view": "daily",
            "from": start.date().isoformat(),
            "to": end.date().isoformat(),
            "days": _daily_buckets(start, end),
        }, None

    if view == "month_compare":
        curr_start = today.replace(day=1)
        prev_month_last = curr_start - timedelta(days=1)
        prev_start = prev_month_last.replace(day=1)
        prev_end = _end_of_day(prev_month_last)
        return {
            "view": "month_compare",
            "current": {
                "label": curr_start.strftime("%b %Y"),
                "year": curr_start.year,
                "month": curr_start.month,
                "days": _daily_buckets(curr_start, now),
            },
            "previous": {
                "label": prev_start.strftime("%b %Y"),
                "year": prev_start.year,
                "month": prev_start.month,
                "days": _daily_buckets(prev_start, prev_end),
            },
        }, None

    if view == "year_compare":
        try:
            year = int(params.get("year") or now.year)
        except (TypeError, ValueError):
            return None, "Invalid year."
        if year < 2000 or year > 2100:
            return None, "Invalid year."
        months = []
        month_names = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ]
        for month in range(1, 13):
            last = monthrange(year, month)[1]
            start = timezone.make_aware(datetime(year, month, 1))
            end = timezone.make_aware(datetime(year, month, last, 23, 59, 59))
            prev_last = monthrange(year - 1, month)[1]
            prev_start = timezone.make_aware(datetime(year - 1, month, 1))
            prev_end = timezone.make_aware(datetime(year - 1, month, prev_last, 23, 59, 59))
            months.append(
                {
                    "month": month,
                    "month_name": month_names[month - 1],
                    "primary_year": year,
                    "compare_year": year - 1,
                    "primary": _triplet(paid_orders().filter(created_at__gte=start, created_at__lte=end)),
                    "compare": _triplet(
                        paid_orders().filter(created_at__gte=prev_start, created_at__lte=prev_end)
                    ),
                }
            )
        return {
            "view": "year_compare",
            "primary_year": year,
            "compare_year": year - 1,
            "months": months,
        }, None

    return None, "Invalid view. Use daily, month_compare, or year_compare."
