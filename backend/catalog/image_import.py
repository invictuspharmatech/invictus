from __future__ import annotations

import re
from pathlib import PurePosixPath

from django.core.files.storage import default_storage
from django.utils.text import slugify

from catalog.models import Category, Product, ProductCategory
from catalog.sku import next_sku_for_category

# Categories that ship from warehouse 1 (peptides / aminos).
WAREHOUSE_1_SLUGS = {"peptides", "peptides-glps", "aminos"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


def normalize_product_name(value: str) -> str:
    """
    Canonical product title for matching.
    Windows filenames cannot contain "/", so oils images use "mg-ml";
    always treat that as the live site spelling "mg/ml" so import updates
    existing products instead of creating duplicates.
    """
    text = str(value or "")
    text = text.replace("_", " ")
    # "300mg-ml" has no word-break before mg; replace the unit token directly.
    text = re.sub(r"(?i)mg-ml", "mg/ml", text)
    return " ".join(text.split())


def product_name_from_filename(filename: str) -> str:
    stem = PurePosixPath(str(filename or "")).stem
    # Underscores → spaces; keep hyphens (BPC-157, IGF1-LR3).
    # mg-ml → mg/ml happens inside normalize_product_name.
    return normalize_product_name(stem)


def sanitize_upload_filename(filename: str) -> str:
    base = PurePosixPath(str(filename or "image.png")).name
    path = PurePosixPath(base)
    ext = path.suffix.lower() or ".png"
    if ext not in IMAGE_EXTENSIONS:
        ext = ".png"
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", path.stem).strip("-._")[:120] or "image"
    return f"{stem}{ext}"


def save_uploaded_product_image(uploaded_file) -> str:
    """
    Persist to Django MEDIA_ROOT/products/ (live: ./data/media via Docker).
    Returns a public URL path nginx serves at /media/...
    """
    name = sanitize_upload_filename(getattr(uploaded_file, "name", "") or "image.png")
    relative = f"products/{name}"
    if default_storage.exists(relative):
        stem = PurePosixPath(name).stem
        ext = PurePosixPath(name).suffix
        n = 2
        while default_storage.exists(f"products/{stem}-{n}{ext}"):
            n += 1
        relative = f"products/{stem}-{n}{ext}"
    saved = default_storage.save(relative, uploaded_file)
    return f"/media/{saved.lstrip('/')}"


def find_product_by_name(name: str) -> Product | None:
    target = normalize_product_name(name)
    if not target:
        return None
    hit = Product.objects.filter(name__iexact=target).first()
    if hit:
        return hit
    key = target.casefold()
    for product in Product.objects.only("id", "name").iterator():
        if normalize_product_name(product.name).casefold() == key:
            return product
    return None


def unique_slug_for(name: str, exclude_id=None) -> str:
    base = slugify(name)[:200] or "product"
    slug = base
    n = 2
    while True:
        qs = Product.objects.filter(slug=slug)
        if exclude_id:
            qs = qs.exclude(pk=exclude_id)
        if not qs.exists():
            return slug
        slug = f"{base}-{n}"[:220]
        n += 1


def import_image_item(
    *,
    name: str,
    image_path: str,
    category: Category,
) -> dict:
    """
    Attach image to an existing product with the same name, or create a draft
    product in the given category with an auto SKU.
    """
    name = normalize_product_name(name)
    image_path = str(image_path or "").strip()
    if not name:
        return {"action": "error", "name": name, "error": "Empty product name."}
    if not image_path:
        return {"action": "error", "name": name, "error": "Missing image path."}

    existing = find_product_by_name(name)
    if existing:
        existing.image = image_path
        existing.save(update_fields=["image"])
        # Ensure category link exists without removing other categories.
        ProductCategory.objects.get_or_create(product=existing, category=category)
        if not (existing.sku or "").strip():
            suggested = next_sku_for_category(category, exclude_ids=[existing.pk])
            if suggested:
                existing.sku = suggested
                existing.save(update_fields=["sku"])
        refreshed = Product.objects.prefetch_related("category_links__category").get(pk=existing.pk)
        return {
            "action": "updated",
            "id": str(refreshed.id),
            "name": refreshed.name,
            "sku": refreshed.sku,
            "image": refreshed.image,
        }

    # Do not create when the only mismatch is a slash variant we already tried.
    # Name is already canonical (mg/ml); create only when truly missing.
    warehouse = (
        Product.Warehouse.WAREHOUSE_1
        if category.slug in WAREHOUSE_1_SLUGS
        else Product.Warehouse.WAREHOUSE_2
    )
    product = Product(
        name=name,
        slug=unique_slug_for(name),
        sku="",
        description="",
        short_description="",
        regular_price=0,
        sale_price=None,
        image=image_path,
        warehouse=warehouse,
        status="draft",
        stock_quantity_w1=0,
        stock_quantity_w2=0,
        allow_backorder=False,
    )
    product.sync_total(save=False)
    product.save()
    ProductCategory.objects.create(product=product, category=category)
    suggested = next_sku_for_category(category, exclude_ids=[product.pk])
    if suggested:
        product.sku = suggested
        product.save(update_fields=["sku"])
    refreshed = Product.objects.prefetch_related("category_links__category").get(pk=product.pk)
    return {
        "action": "created",
        "id": str(refreshed.id),
        "name": refreshed.name,
        "sku": refreshed.sku,
        "image": refreshed.image,
    }
