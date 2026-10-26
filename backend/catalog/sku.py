"""SKU helpers: IP-{CATEGORY_ABBR}-001"""

from __future__ import annotations

import re

from catalog.models import Category, Product

SKU_RE = re.compile(r"^IP-([A-Z0-9]+)-(\d+)$", re.IGNORECASE)


def normalize_abbr(raw: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (raw or "").upper())


def format_sku(abbr: str, number: int) -> str:
    return f"IP-{abbr}-{int(number):03d}"


def parse_sku(sku: str | None) -> tuple[str, int] | None:
    match = SKU_RE.match((sku or "").strip())
    if not match:
        return None
    return match.group(1).upper(), int(match.group(2))


def max_sequence_for_abbr(abbr: str, *, exclude_ids: list | None = None) -> int:
    abbr = normalize_abbr(abbr)
    if not abbr:
        return 0
    qs = Product.objects.filter(sku__istartswith=f"IP-{abbr}-")
    if exclude_ids:
        qs = qs.exclude(pk__in=exclude_ids)
    max_n = 0
    for sku in qs.values_list("sku", flat=True):
        parsed = parse_sku(sku)
        if parsed and parsed[0] == abbr:
            max_n = max(max_n, parsed[1])
    return max_n


def next_sku_for_category(category: Category, *, exclude_ids: list | None = None) -> str | None:
    abbr = normalize_abbr(category.sku_abbreviation)
    if not abbr:
        return None
    return format_sku(abbr, max_sequence_for_abbr(abbr, exclude_ids=exclude_ids) + 1)


def generate_skus_for_category(
    category: Category,
    *,
    rewrite_existing: bool = False,
    dry_run: bool = False,
) -> dict:
    abbr = normalize_abbr(category.sku_abbreviation)
    if not abbr:
        raise ValueError(
            "This category has no SKU abbreviation. Edit the category and set one (e.g. OILS)."
        )

    products = list(
        Product.objects.filter(category_links__category=category)
        .distinct()
        .order_by("name", "id")
    )
    to_update: list[Product] = []
    skipped: list[dict] = []
    for product in products:
        has_sku = bool((product.sku or "").strip())
        if has_sku and not rewrite_existing:
            skipped.append(
                {
                    "productId": str(product.id),
                    "name": product.name,
                    "oldSku": product.sku,
                    "newSku": product.sku,
                    "reason": "already_set",
                }
            )
            continue
        to_update.append(product)

    exclude_ids = [p.pk for p in to_update] if rewrite_existing else []
    next_n = max_sequence_for_abbr(abbr, exclude_ids=exclude_ids) + 1
    assignments: list[dict] = []
    used: set[str] = set(
        Product.objects.exclude(pk__in=exclude_ids)
        .exclude(sku="")
        .values_list("sku", flat=True)
    )

    for product in to_update:
        while True:
            candidate = format_sku(abbr, next_n)
            next_n += 1
            if candidate not in used:
                break
        old = product.sku or ""
        assignments.append(
            {
                "productId": str(product.id),
                "name": product.name,
                "oldSku": old,
                "newSku": candidate,
            }
        )
        used.add(candidate)
        if not dry_run:
            product.sku = candidate
            product.save(update_fields=["sku"])

    return {
        "ok": True,
        "categoryId": str(category.id),
        "categoryName": category.name,
        "abbreviation": abbr,
        "dryRun": dry_run,
        "rewriteExisting": rewrite_existing,
        "updated": 0 if dry_run else len(assignments),
        "wouldUpdate": len(assignments),
        "skipped": len(skipped),
        "assignments": assignments,
        "skippedRows": skipped,
    }
