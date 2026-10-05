import re

from django.http import HttpResponse
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsPortalStaff, IsStoreStaff, is_full_admin, managed_warehouse
from catalog.models import (
    Category,
    Product,
    ProductCategory,
    ProductStockSubscription,
    StockNotificationBatch,
    StockTransferRequest,
    TestResult,
)
from catalog.serializers import (
    CategorySerializer,
    CategoryWriteSerializer,
    ProductSerializer,
    ProductWriteSerializer,
    StockTransferSerializer,
    TestResultSerializer,
)
from orders.fulfillment import (
    FulfillmentError,
    approve_stock_transfer,
    can_review_transfer,
    get_warehouse_settings,
    opposite_warehouse,
    reject_stock_transfer,
)


def slugify(value: str) -> str:
    value = value.lower().replace("&", "")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


@api_view(["GET"])
@permission_classes([AllowAny])
def category_list(request):
    qs = Category.objects.all()
    slugs = request.GET.get("slugs")
    if slugs:
        qs = qs.filter(slug__in=[item.strip() for item in slugs.split(",") if item.strip()])
    return Response(CategorySerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def product_list(request):
    qs = Product.objects.prefetch_related("category_links__category")
    if request.GET.get("all") != "1":
        qs = qs.filter(status="publish")
    q = request.GET.get("q")
    if q:
        qs = qs.filter(
            Q(name__icontains=q) | Q(short_description__icontains=q) | Q(sku__icontains=q)
        )
    category = request.GET.get("category")
    if category:
        qs = qs.filter(category_links__category__slug=category).distinct()
    if request.GET.get("featured") == "1":
        qs = qs.filter(is_featured=True)
    if request.GET.get("newArrival") == "1":
        qs = qs.filter(is_new_arrival=True)
    limit = request.GET.get("limit")
    if limit:
        qs = qs[: int(limit)]
    return Response(ProductSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def product_detail(request, slug):
    product = (
        Product.objects.prefetch_related("category_links__category").filter(slug=slug).first()
    )
    if not product:
        return Response({"error": "Not found."}, status=404)
    return Response(ProductSerializer(product, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def test_result_list(request):
    return Response(TestResultSerializer(TestResult.objects.all(), many=True).data)


@api_view(["GET", "POST"])
@permission_classes([IsPortalStaff])
def admin_product_list(request):
    if request.method == "POST":
        if not is_full_admin(request.user):
            return Response({"error": "Not allowed."}, status=403)
        serializer = ProductWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = _save_product(Product(), serializer.validated_data)
        return Response(ProductSerializer(product, context={"request": request}).data, status=201)
    qs = Product.objects.prefetch_related("category_links__category")
    q = request.GET.get("q")
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q))
    warehouse = request.GET.get("warehouse")
    if warehouse == "1":
        qs = qs.filter(warehouse=Product.Warehouse.WAREHOUSE_1)
    elif warehouse == "2":
        qs = qs.filter(warehouse=Product.Warehouse.WAREHOUSE_2)
    return Response(ProductSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsPortalStaff])
def admin_product_detail(request, pk):
    product = Product.objects.prefetch_related("category_links__category").filter(pk=pk).first()
    if not product:
        return Response({"error": "Product not found."}, status=404)
    if request.method == "GET":
        return Response(ProductSerializer(product, context={"request": request}).data)
    if not is_full_admin(request.user):
        return Response({"error": "Not allowed."}, status=403)
    if request.method == "DELETE":
        product.delete()
        return Response({"ok": True})
    serializer = ProductWriteSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    product = _save_product(product, serializer.validated_data)
    return Response(ProductSerializer(product, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_product_warehouse(request, pk):
    product = Product.objects.filter(pk=pk).first()
    if not product:
        return Response({"error": "Product not found."}, status=404)
    product.warehouse = (
        Product.Warehouse.WAREHOUSE_2
        if product.warehouse == Product.Warehouse.WAREHOUSE_1
        else Product.Warehouse.WAREHOUSE_1
    )
    product.save(update_fields=["warehouse"])
    return Response({"ok": True, "warehouse": product.warehouse})


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_test_results(request):
    if request.method == "POST":
        item = TestResult.objects.create(
            product_name=request.data.get("productName") or "",
            category=request.data.get("category") or "",
            image_path=request.data.get("imagePath") or "",
            sort_order=int(request.data.get("sortOrder") or 0),
        )
        return Response(TestResultSerializer(item).data, status=201)
    return Response(TestResultSerializer(TestResult.objects.all(), many=True).data)


@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_test_result_detail(request, pk):
    item = TestResult.objects.filter(pk=pk).first()
    if not item:
        return Response({"error": "Not found."}, status=404)
    if request.method == "DELETE":
        item.delete()
        return Response({"ok": True})
    if request.data.get("productName") is not None:
        item.product_name = request.data["productName"]
    if request.data.get("category") is not None:
        item.category = request.data["category"]
    if request.data.get("imagePath") is not None:
        item.image_path = request.data["imagePath"]
    if request.data.get("sortOrder") is not None:
        item.sort_order = int(request.data["sortOrder"])
    item.save()
    return Response(TestResultSerializer(item).data)


def _save_product(product: Product, data: dict) -> Product:
    if data.get("name"):
        product.name = data["name"]
    product.sku = data.get("sku", product.sku or "")
    product.description = data.get("description", product.description or "")
    product.short_description = data.get("shortDescription", product.short_description or "")
    if "regularPrice" in data:
        product.regular_price = data["regularPrice"]
    if "salePrice" in data:
        product.sale_price = data["salePrice"]
    if "image" in data:
        product.image = data["image"] or ""
    if "warehouse" in data:
        product.warehouse = data["warehouse"]
    if "status" in data:
        product.status = data["status"]
    if "isFeatured" in data:
        product.is_featured = data["isFeatured"]
    if "isNewArrival" in data:
        product.is_new_arrival = data["isNewArrival"]
    if "allowBackorder" in data:
        product.allow_backorder = data["allowBackorder"]
    if "maxQuantityPerOrder" in data:
        product.max_quantity_per_order = data["maxQuantityPerOrder"]
    if "stockQuantityW1" in data:
        product.stock_quantity_w1 = int(data["stockQuantityW1"] or 0)
    if "stockQuantityW2" in data:
        product.stock_quantity_w2 = int(data["stockQuantityW2"] or 0)
    previous_status = product.stock_status
    product.sync_total(save=False)
    slug = data.get("slug") or product.slug or slugify(product.name)
    product.slug = slug
    if product.regular_price is None:
        product.regular_price = 0
    product.save()
    from catalog.stock_notify import maybe_dispatch_restock

    maybe_dispatch_restock(product, previous_status)
    if "categoryIds" in data:
        ProductCategory.objects.filter(product=product).delete()
        for category_id in data["categoryIds"]:
            category = Category.objects.filter(pk=category_id).first()
            if category:
                ProductCategory.objects.get_or_create(product=product, category=category)
    return Product.objects.prefetch_related("category_links__category").get(pk=product.pk)


@api_view(["GET", "POST"])
@permission_classes([IsPortalStaff])
def admin_stock_transfers(request):
    if request.method == "POST":
        policy = get_warehouse_settings()
        if not policy.split_enabled or not policy.warehouse_request_enabled:
            return Response({"error": "Warehouse requests are disabled."}, status=400)
        product = Product.objects.filter(pk=request.data.get("productId")).first()
        if not product:
            return Response({"error": "Product not found."}, status=404)
        quantity = int(request.data.get("quantity") or 0)
        if quantity < 1:
            return Response({"error": "Quantity must be at least 1."}, status=400)
        to_warehouse = managed_warehouse(request.user) or request.data.get("toWarehouse")
        if to_warehouse not in (Product.Warehouse.WAREHOUSE_1, Product.Warehouse.WAREHOUSE_2):
            return Response({"error": "Destination warehouse is required."}, status=400)
        from_warehouse = opposite_warehouse(to_warehouse)
        row = StockTransferRequest.objects.create(
            product=product,
            quantity=quantity,
            from_warehouse=from_warehouse,
            to_warehouse=to_warehouse,
            note=request.data.get("note") or "",
            requested_by=request.user,
        )
        return Response(StockTransferSerializer(row).data, status=201)
    qs = StockTransferRequest.objects.select_related("product", "requested_by", "reviewed_by")
    warehouse = managed_warehouse(request.user)
    if warehouse:
        qs = qs.filter(Q(from_warehouse=warehouse) | Q(to_warehouse=warehouse))
    return Response(StockTransferSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def admin_stock_transfer_review(request, pk):
    row = StockTransferRequest.objects.select_related("product").filter(pk=pk).first()
    if not row:
        return Response({"error": "Not found."}, status=404)
    if not can_review_transfer(request.user, row.from_warehouse):
        return Response({"error": "You cannot review this request."}, status=403)
    action = request.data.get("action")
    try:
        if action == "approve":
            approve_stock_transfer(row, request.user)
        elif action == "reject":
            reject_stock_transfer(row, request.user)
        else:
            return Response({"error": "Invalid action."}, status=400)
    except FulfillmentError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response(StockTransferSerializer(row).data)


def _save_category(category: Category, data: dict) -> Category:
    name = data.get("name") or category.name
    slug = (data.get("slug") or "").strip() or slugify(name)
    category.name = name
    category.slug = slug
    if "description" in data:
        category.description = data.get("description") or ""
    if "image" in data:
        category.image = data.get("image") or ""
    if "sortOrder" in data and data.get("sortOrder") is not None:
        category.sort_order = int(data.get("sortOrder") or 0)
    category.save()
    return category


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_category_list(request):
    if request.method == "POST":
        serializer = CategoryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = _save_category(Category(), serializer.validated_data)
        return Response(CategorySerializer(category).data, status=201)
    return Response(CategorySerializer(Category.objects.all(), many=True).data)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_category_detail(request, pk):
    category = Category.objects.filter(pk=pk).first()
    if not category:
        return Response({"error": "Not found."}, status=404)
    if request.method == "GET":
        return Response(CategorySerializer(category).data)
    if request.method == "DELETE":
        category.delete()
        return Response({"ok": True})
    serializer = CategoryWriteSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    category = _save_category(category, serializer.validated_data)
    return Response(CategorySerializer(category).data)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_products_import(request):
    from catalog.csv_io import import_products

    if not is_full_admin(request.user):
        return Response({"error": "Not allowed."}, status=403)
    result = import_products(request.data.get("csvData") or request.data.get("csv_data") or "")
    return Response(result)


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_products_export(request):
    from catalog.csv_io import export_products

    response = HttpResponse(export_products(), content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="products.csv"'
    return response


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_categories_import(request):
    from catalog.csv_io import import_categories

    if not is_full_admin(request.user):
        return Response({"error": "Not allowed."}, status=403)
    return Response(import_categories(request.data.get("csvData") or request.data.get("csv_data") or ""))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_categories_export(request):
    from catalog.csv_io import export_categories

    response = HttpResponse(export_categories(), content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="categories.csv"'
    return response


@api_view(["POST", "GET", "DELETE"])
@permission_classes([AllowAny])
def product_stock_notify(request, pk):
    from catalog.stock_notify import subscribe, subscription_status, unsubscribe

    product = Product.objects.filter(pk=pk).first()
    if not product:
        return Response({"error": "Not found."}, status=404)
    user = request.user if getattr(request.user, "is_authenticated", False) else None
    email = (request.data.get("email") if request.method != "GET" else request.GET.get("email")) or (
        getattr(user, "email", "") if user else ""
    )
    if request.method == "GET":
        return Response(subscription_status(product, email))
    if request.method == "DELETE":
        unsubscribe(product, email)
        return Response({"ok": True})
    try:
        row = subscribe(product, email, request.data.get("name") or getattr(user, "name", ""), user)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response({"ok": True, "status": row.status})


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_stock_batches(request):
    from catalog.stock_notify import serialize_batch

    qs = StockNotificationBatch.objects.select_related("product").all()
    return Response([serialize_batch(row) for row in qs[:100]])


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def admin_stock_subscriptions(request):
    qs = ProductStockSubscription.objects.select_related("product").all()
    status = request.GET.get("status")
    if status:
        qs = qs.filter(status=status)
    return Response(
        [
            {
                "id": str(row.id),
                "email": row.email,
                "name": row.name,
                "status": row.status,
                "productId": str(row.product_id),
                "productName": row.product.name,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
            }
            for row in qs[:300]
        ]
    )


@api_view(["POST", "DELETE"])
@permission_classes([IsPortalStaff])
def admin_stock_batch_action(request, pk):
    from catalog.stock_notify import process_chunk, serialize_batch

    batch = StockNotificationBatch.objects.select_related("product").filter(pk=pk).first()
    if not batch:
        return Response({"error": "Not found."}, status=404)
    if request.method == "DELETE":
        batch.delete()
        return Response({"ok": True})
    action = request.data.get("action")
    if action == "pause":
        batch.status = StockNotificationBatch.Status.PAUSED
        batch.save(update_fields=["status", "updated_at"])
    elif action == "resume":
        batch.status = StockNotificationBatch.Status.RUNNING
        batch.save(update_fields=["status", "updated_at"])
        process_chunk(batch)
        batch.refresh_from_db()
    elif action == "stop":
        batch.status = StockNotificationBatch.Status.STOPPED
        batch.save(update_fields=["status", "updated_at"])
    else:
        return Response({"error": "Invalid action."}, status=400)
    return Response(serialize_batch(batch))

