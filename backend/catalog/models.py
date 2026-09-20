import uuid

from django.db import models


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, max_length=160)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    image = models.CharField(max_length=500, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    class Warehouse(models.TextChoices):
        WAREHOUSE_1 = "WAREHOUSE_1", "Warehouse 1"
        WAREHOUSE_2 = "WAREHOUSE_2", "Warehouse 2"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_id = models.IntegerField(unique=True, null=True, blank=True)
    slug = models.SlugField(unique=True, max_length=220)
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    short_description = models.TextField(blank=True)
    regular_price = models.FloatField()
    sale_price = models.FloatField(null=True, blank=True)
    image = models.CharField(max_length=700, blank=True)
    stock_status = models.CharField(max_length=40, default="instock")
    stock_quantity = models.IntegerField(null=True, blank=True)
    stock_quantity_w1 = models.IntegerField(default=0)
    stock_quantity_w2 = models.IntegerField(default=0)
    max_quantity_per_order = models.IntegerField(null=True, blank=True)
    allow_backorder = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    is_new_arrival = models.BooleanField(default=False)
    warehouse = models.CharField(
        max_length=20, choices=Warehouse.choices, default=Warehouse.WAREHOUSE_2
    )
    status = models.CharField(max_length=20, default="publish")
    categories = models.ManyToManyField(Category, through="ProductCategory", related_name="products")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def stock_for(self, warehouse: str) -> int:
        if warehouse == self.Warehouse.WAREHOUSE_1:
            return int(self.stock_quantity_w1 or 0)
        return int(self.stock_quantity_w2 or 0)

    def sync_total(self, save: bool = False) -> None:
        self.stock_quantity = int(self.stock_quantity_w1 or 0) + int(self.stock_quantity_w2 or 0)
        self.stock_status = "instock" if self.stock_quantity > 0 else "outofstock"
        if save:
            self.save(
                update_fields=[
                    "stock_quantity_w1",
                    "stock_quantity_w2",
                    "stock_quantity",
                    "stock_status",
                ]
            )

    def adjust_stock(self, warehouse: str, delta: int, save: bool = True) -> None:
        if warehouse == self.Warehouse.WAREHOUSE_1:
            self.stock_quantity_w1 = int(self.stock_quantity_w1 or 0) + delta
        else:
            self.stock_quantity_w2 = int(self.stock_quantity_w2 or 0) + delta
        self.sync_total(save=save)


class ProductCategory(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="category_links"
    )
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="product_links"
    )

    class Meta:
        unique_together = ("product", "category")


class TestResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product_name = models.CharField(max_length=255)
    category = models.CharField(max_length=160)
    image_path = models.CharField(max_length=700)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "product_name"]

    def __str__(self):
        return self.product_name


class StockTransferRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="stock_transfers"
    )
    quantity = models.IntegerField()
    from_warehouse = models.CharField(max_length=20, choices=Product.Warehouse.choices)
    to_warehouse = models.CharField(max_length=20, choices=Product.Warehouse.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    note = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="stock_transfer_requests",
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_transfer_reviews",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name} × {self.quantity}"
