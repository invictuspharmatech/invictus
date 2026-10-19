from django.test import TestCase
from unittest.mock import patch

from accounts.models import User
from catalog.csv_io import export_categories, export_products, import_categories, import_products
from catalog.models import Category, Product, ProductCategory, ProductStockSubscription
from catalog.stock_notify import dispatch_for_product, subscribe
from rest_framework.test import APIClient


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

    def test_single_category_import_adds_without_removing_others(self):
        oils = Category.objects.create(name="Oils", slug="oils")
        peptides = Category.objects.create(name="Peptides", slug="peptides")
        kept = Product.objects.create(name="Keep Oil", slug="keep-oil", sku="OIL-KEEP", regular_price=20)
        kept.category_links.create(category=oils)
        before_ids = set(Product.objects.values_list("id", flat=True))

        result = import_products(
            "post_title,sku,regular_price,stock,tax:product_cat\n"
            "New Peptide,PEP-NEW,40,8,Peptides\n"
        )

        self.assertEqual(result["imported"], 1)
        self.assertEqual(result["skipped"], 0)
        self.assertTrue(Product.objects.filter(pk=kept.pk).exists())
        self.assertEqual(Product.objects.count(), 2)
        self.assertEqual(set(Product.objects.values_list("id", flat=True)) - {Product.objects.get(sku="PEP-NEW").id}, before_ids)
        self.assertEqual(Product.objects.filter(category_links__category=oils).count(), 1)
        added = Product.objects.get(sku="PEP-NEW")
        self.assertTrue(added.category_links.filter(category=peptides).exists())

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


class ProductBulkEditTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="bulk-admin@example.com",
            password="pass1234",
            name="Admin",
            role=User.Role.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.cat_a = Category.objects.create(name="Oils", slug="oils")
        self.cat_b = Category.objects.create(name="Orals", slug="orals")
        self.p1 = Product.objects.create(
            name="Alpha",
            slug="alpha-bulk",
            sku="BULK-A",
            regular_price=100,
            sale_price=None,
            warehouse=Product.Warehouse.WAREHOUSE_2,
            status="publish",
        )
        self.p2 = Product.objects.create(
            name="Beta",
            slug="beta-bulk",
            sku="BULK-B",
            regular_price=80,
            sale_price=70,
            warehouse=Product.Warehouse.WAREHOUSE_2,
            status="publish",
        )
        ProductCategory.objects.create(product=self.p1, category=self.cat_a)

    def test_sale_percent_and_flat(self):
        res = self.client.post(
            "/api/admin/products/bulk/",
            {"ids": [str(self.p1.id), str(self.p2.id)], "action": "sale_percent", "percent": 20},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.p1.refresh_from_db()
        self.p2.refresh_from_db()
        self.assertEqual(self.p1.sale_price, 80.0)
        self.assertEqual(self.p2.sale_price, 64.0)

        res = self.client.post(
            "/api/admin/products/bulk/",
            {"ids": [str(self.p1.id)], "action": "sale_flat", "amount": 50},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.sale_price, 50.0)

    def test_set_category_status_warehouse_delete(self):
        res = self.client.post(
            "/api/admin/products/bulk/",
            {
                "ids": [str(self.p1.id), str(self.p2.id)],
                "action": "set_categories",
                "categoryIds": [str(self.cat_b.id)],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            list(self.p1.category_links.values_list("category_id", flat=True)),
            [self.cat_b.id],
        )
        self.assertEqual(
            list(self.p2.category_links.values_list("category_id", flat=True)),
            [self.cat_b.id],
        )

        res = self.client.post(
            "/api/admin/products/bulk/",
            {"ids": [str(self.p1.id)], "action": "set_status", "status": "draft"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, "draft")

        res = self.client.post(
            "/api/admin/products/bulk/",
            {
                "ids": [str(self.p1.id), str(self.p2.id)],
                "action": "set_warehouse",
                "warehouse": Product.Warehouse.WAREHOUSE_1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.p1.refresh_from_db()
        self.p2.refresh_from_db()
        self.assertEqual(self.p1.warehouse, Product.Warehouse.WAREHOUSE_1)
        self.assertEqual(self.p2.warehouse, Product.Warehouse.WAREHOUSE_1)

        res = self.client.post(
            "/api/admin/products/bulk/",
            {"ids": [str(self.p2.id)], "action": "delete"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(Product.objects.filter(pk=self.p2.pk).exists())
