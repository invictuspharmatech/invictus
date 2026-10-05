from django.test import TestCase
from unittest.mock import patch

from catalog.csv_io import export_categories, export_products, import_categories, import_products
from catalog.models import Category, Product, ProductStockSubscription
from catalog.stock_notify import dispatch_for_product, subscribe


class CatalogCsvTests(TestCase):
    def test_import_and_export_products(self):
        Category.objects.create(name="Peptides", slug="peptides")
        result = import_products(
            "post_title,sku,regular_price,stock,tax:product_cat\n"
            "Alpha,SKU-A,40,8,Peptides\n"
        )
        self.assertEqual(result["imported"], 1)
        product = Product.objects.get(sku="SKU-A")
        self.assertEqual(product.name, "Alpha")
        self.assertEqual(product.stock_quantity, 8)
        csv_text = export_products()
        self.assertIn("SKU-A", csv_text)
        self.assertIn("Peptides", csv_text)

    def test_duplicate_sku_is_skipped(self):
        import_products("name,sku,regular_price\nAlpha,SKU-A,10\n")
        result = import_products("name,sku,regular_price\nAlpha again,SKU-A,12\n")
        self.assertEqual(result["imported"], 0)
        self.assertEqual(result["skipped"], 1)

    def test_import_and_export_categories(self):
        result = import_categories("name,description,sort_order\nResearch,Lab use,2\n")
        self.assertEqual(result["imported"], 1)
        category = Category.objects.get(name="Research")
        self.assertEqual(category.sort_order, 2)
        self.assertIn("Research", export_categories())


class StockNotifyTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            name="Beta",
            slug="beta",
            sku="BETA",
            regular_price=20,
            stock_quantity_w1=0,
            stock_quantity_w2=0,
            stock_quantity=0,
            stock_status="outofstock",
        )

    def test_subscribe_requires_out_of_stock(self):
        self.product.stock_quantity_w2 = 4
        self.product.sync_total(save=True)
        with self.assertRaises(ValueError):
            subscribe(self.product, "wait@example.com")

    def test_restock_creates_batch(self):
        subscribe(self.product, "wait@example.com", "Waiter")
        self.assertEqual(ProductStockSubscription.objects.filter(status="active").count(), 1)
        self.assertIsNone(dispatch_for_product(self.product))
        self.product.stock_quantity_w2 = 3
        self.product.sync_total(save=True)
        with patch("catalog.stock_notify._send_one"):
            batch = dispatch_for_product(self.product)
        self.assertIsNotNone(batch)
        batch.refresh_from_db()
        self.assertEqual(batch.sent_count, 1)
        self.assertEqual(
            ProductStockSubscription.objects.get(email="wait@example.com").status,
            ProductStockSubscription.Status.NOTIFIED,
        )
