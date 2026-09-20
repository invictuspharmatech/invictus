from rest_framework import serializers

from catalog.models import Category, Product, StockTransferRequest, TestResult


class CategorySerializer(serializers.ModelSerializer):
    sortOrder = serializers.IntegerField(source="sort_order")

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "description", "image", "sortOrder"]


class NestedCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "slug", "name"]


class ProductSerializer(serializers.ModelSerializer):
    shortDescription = serializers.CharField(source="short_description")
    regularPrice = serializers.FloatField(source="regular_price")
    salePrice = serializers.FloatField(source="sale_price", allow_null=True)
    stockStatus = serializers.CharField(source="stock_status")
    stockQuantity = serializers.SerializerMethodField()
    stockQuantityW1 = serializers.SerializerMethodField()
    stockQuantityW2 = serializers.SerializerMethodField()
    maxQuantityPerOrder = serializers.IntegerField(
        source="max_quantity_per_order", allow_null=True
    )
    allowBackorder = serializers.BooleanField(source="allow_backorder")
    isFeatured = serializers.BooleanField(source="is_featured")
    isNewArrival = serializers.BooleanField(source="is_new_arrival")
    sourceId = serializers.IntegerField(source="source_id", allow_null=True)
    categories = serializers.SerializerMethodField()
    categoryIds = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "sourceId",
            "slug",
            "name",
            "sku",
            "description",
            "shortDescription",
            "regularPrice",
            "salePrice",
            "image",
            "stockStatus",
            "stockQuantity",
            "stockQuantityW1",
            "stockQuantityW2",
            "maxQuantityPerOrder",
            "allowBackorder",
            "isFeatured",
            "isNewArrival",
            "warehouse",
            "status",
            "categories",
            "categoryIds",
        ]

    def get_categories(self, obj):
        links = obj.category_links.select_related("category").all()
        return [{"category": NestedCategorySerializer(link.category).data} for link in links]

    def get_categoryIds(self, obj):
        return [str(link.category_id) for link in obj.category_links.all()]

    def _viewer(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_stockQuantity(self, obj):
        user = self._viewer()
        role = getattr(user, "role", None)
        if role in ("WAREHOUSE_1", "WAREHOUSE_2"):
            return None
        return obj.stock_quantity

    def get_stockQuantityW1(self, obj):
        user = self._viewer()
        role = getattr(user, "role", None)
        if role in ("ADMIN", "SUPERUSER", "WAREHOUSE_1"):
            return obj.stock_quantity_w1
        return None

    def get_stockQuantityW2(self, obj):
        user = self._viewer()
        role = getattr(user, "role", None)
        if role in ("ADMIN", "SUPERUSER", "WAREHOUSE_2"):
            return obj.stock_quantity_w2
        return None


class ProductWriteSerializer(serializers.Serializer):
    name = serializers.CharField()
    slug = serializers.CharField(required=False, allow_blank=True)
    sku = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    shortDescription = serializers.CharField(required=False, allow_blank=True)
    image = serializers.CharField(required=False, allow_blank=True)
    regularPrice = serializers.FloatField()
    salePrice = serializers.FloatField(required=False, allow_null=True)
    warehouse = serializers.ChoiceField(
        choices=Product.Warehouse.choices, required=False
    )
    status = serializers.CharField(required=False)
    isFeatured = serializers.BooleanField(required=False)
    isNewArrival = serializers.BooleanField(required=False)
    maxQuantityPerOrder = serializers.IntegerField(required=False, allow_null=True)
    stockQuantityW1 = serializers.IntegerField(required=False)
    stockQuantityW2 = serializers.IntegerField(required=False)
    allowBackorder = serializers.BooleanField(required=False)
    categoryIds = serializers.ListField(
        child=serializers.CharField(), required=False
    )


class TestResultSerializer(serializers.ModelSerializer):
    productName = serializers.CharField(source="product_name")
    imagePath = serializers.CharField(source="image_path")
    sortOrder = serializers.IntegerField(source="sort_order")

    class Meta:
        model = TestResult
        fields = ["id", "productName", "category", "imagePath", "sortOrder"]


class StockTransferSerializer(serializers.ModelSerializer):
    productId = serializers.UUIDField(source="product_id")
    productName = serializers.CharField(source="product.name", read_only=True)
    fromWarehouse = serializers.CharField(source="from_warehouse")
    toWarehouse = serializers.CharField(source="to_warehouse")
    requestedBy = serializers.CharField(source="requested_by.email", read_only=True, allow_null=True)
    reviewedBy = serializers.CharField(source="reviewed_by.email", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    reviewedAt = serializers.DateTimeField(source="reviewed_at", read_only=True, allow_null=True)

    class Meta:
        model = StockTransferRequest
        fields = [
            "id",
            "productId",
            "productName",
            "quantity",
            "fromWarehouse",
            "toWarehouse",
            "status",
            "note",
            "requestedBy",
            "reviewedBy",
            "createdAt",
            "reviewedAt",
        ]
