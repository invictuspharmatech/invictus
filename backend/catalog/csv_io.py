from __future__ import annotations

import csv
import io
import re
from typing import Any

from catalog.models import Category, Product, ProductCategory


def slugify(value: str) -> str:
    value = value.lower().replace("&", "")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def _norm(header: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (header or "").strip().lower())


def _row_get(row: dict[str, str], *aliases: str) -> str:
    for alias in aliases:
        key = _norm(alias)
        if key in row and row[key] not in (None, ""):
            return str(row[key]).strip()
    return ""


def _parse_csv(raw: str) -> list[dict[str, str]]:
    text = (raw or "").lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for item in reader:
        mapped = {_norm(str(key or "")): str(value or "").strip() for key, value in item.items()}
        if any(mapped.values()):
            rows.append(mapped)
    return rows


def _unique_slug(base: str, model) -> str:
    slug = slugify(base) or "item"
    candidate = slug
    index = 2
    while model.objects.filter(slug=candidate).exists():
        candidate = f"{slug}-{index}"
        index += 1
    return candidate


def _map_stock_status(raw: str) -> str:
    key = _norm(raw)
    if key in ("outofstock", "out_of_stock", "outofstock"):
        return "outofstock"
    if key in ("onbackorder", "on_backorder"):
        return "onbackorder"
    if key in ("alwaysinstock", "always_in_stock"):
        return "instock"
    return "instock"


def import_products(raw: str) -> dict[str, Any]:
    imported = 0
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(_parse_csv(raw), start=2):
        name = _row_get(row, "post_title", "name")
        if not name:
            skipped += 1
            errors.append(f"Row {index}: missing name")
            continue
        sku = _row_get(row, "sku")
        if sku and Product.objects.filter(sku__iexact=sku).exists():
            skipped += 1
            errors.append(f"Row {index}: SKU {sku} already exists")
            continue
        try:
            regular = float(_row_get(row, "regular_price", "regularprice") or 0)
        except ValueError:
            regular = 0.0
        sale_raw = _row_get(row, "sale_price", "saleprice")
        try:
            sale = float(sale_raw) if sale_raw else None
        except ValueError:
            sale = None
        status_raw = _row_get(row, "post_status", "status").lower()
        status = "publish" if status_raw in ("", "publish", "active", "1") else "draft"
        w1_raw = _row_get(row, "stock_quantity_w1", "stockw1")
        w2_raw = _row_get(row, "stock_quantity_w2", "stockw2")
        stock_raw = _row_get(row, "stock", "stock_quantity", "stockquantity")
        try:
            w1 = int(float(w1_raw)) if w1_raw else 0
            w2 = int(float(w2_raw)) if w2_raw else 0
            total = int(float(stock_raw)) if stock_raw else w1 + w2
        except ValueError:
            w1 = w2 = total = 0
        if not w1_raw and not w2_raw:
            w2 = total
            w1 = 0
        product = Product(
            name=name,
            sku=sku,
            slug=_unique_slug(name, Product),
            description=_row_get(row, "post_content", "description"),
            short_description=_row_get(row, "post_excerpt", "shortdescription"),
            regular_price=regular,
            sale_price=sale,
            image=_row_get(row, "images", "image"),
            stock_quantity_w1=w1,
            stock_quantity_w2=w2,
            status=status,
            stock_status=_map_stock_status(_row_get(row, "stock_status", "stockstatus")),
        )
        product.sync_total(save=False)
        product.save()
        cats = _row_get(row, "tax:product_cat", "categories")
        for label in [part.strip() for part in re.split(r"[;,]", cats) if part.strip()]:
            category = Category.objects.filter(name__iexact=label).first()
            if category:
                ProductCategory.objects.get_or_create(product=product, category=category)
        imported += 1
    return {"imported": imported, "skipped": skipped, "errors": errors[:50]}


def export_products() -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "ID",
            "Name",
            "SKU",
            "Status",
            "Regular Price",
            "Sale Price",
            "Stock Status",
            "Stock Quantity",
            "Stock W1",
            "Stock W2",
            "Categories",
            "Created At",
        ]
    )
    for product in Product.objects.prefetch_related("category_links__category").all():
        categories = "; ".join(
            link.category.name for link in product.category_links.all() if link.category_id
        )
        writer.writerow(
            [
                str(product.id),
                product.name,
                product.sku,
                product.status,
                product.regular_price,
                product.sale_price or "",
                product.stock_status,
                product.stock_quantity or 0,
                product.stock_quantity_w1 or 0,
                product.stock_quantity_w2 or 0,
                categories,
                product.created_at.isoformat() if product.created_at else "",
            ]
        )
    return buffer.getvalue()


def import_categories(raw: str) -> dict[str, Any]:
    imported = 0
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(_parse_csv(raw), start=2):
        name = _row_get(row, "name")
        if not name:
            skipped += 1
            errors.append(f"Row {index}: missing name")
            continue
        if Category.objects.filter(name__iexact=name).exists():
            skipped += 1
            errors.append(f"Row {index}: {name} already exists")
            continue
        try:
            sort_order = int(float(_row_get(row, "sort_order", "sortorder") or 0))
        except ValueError:
            sort_order = 0
        Category.objects.create(
            name=name,
            slug=_unique_slug(name, Category),
            description=_row_get(row, "description"),
            sort_order=sort_order,
        )
        imported += 1
    return {"imported": imported, "skipped": skipped, "errors": errors[:50]}


def export_categories() -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["ID", "Name", "Slug", "Description", "Sort Order"])
    for category in Category.objects.all():
        writer.writerow(
            [str(category.id), category.name, category.slug, category.description, category.sort_order]
        )
    return buffer.getvalue()
