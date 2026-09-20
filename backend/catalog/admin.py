from django.contrib import admin

from catalog.models import Category, Product, ProductCategory, StockTransferRequest, TestResult


class ProductCategoryInline(admin.TabularInline):
    model = ProductCategory
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "regular_price", "warehouse", "status", "is_featured")
    list_filter = ("warehouse", "status", "is_featured")
    search_fields = ("name", "sku", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductCategoryInline]
    fieldsets = (
        (None, {"fields": ("name", "slug", "sku", "status", "warehouse")}),
        ("Copy", {"fields": ("short_description", "description", "image")}),
        ("Pricing", {"fields": ("regular_price", "sale_price")}),
        (
            "Flags",
            {
                "fields": (
                    "is_featured",
                    "is_new_arrival",
                    "stock_status",
                    "stock_quantity",
                    "stock_quantity_w1",
                    "stock_quantity_w2",
                    "allow_backorder",
                    "max_quantity_per_order",
                )
            },
        ),
    )


@admin.register(TestResult)
class TestResultAdmin(admin.ModelAdmin):
    list_display = ("product_name", "category", "sort_order")
    search_fields = ("product_name", "category")


@admin.register(StockTransferRequest)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "quantity",
        "from_warehouse",
        "to_warehouse",
        "status",
        "created_at",
    )
    list_filter = ("status", "from_warehouse", "to_warehouse")
