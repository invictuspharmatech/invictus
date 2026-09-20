import uuid

from django.db import migrations, models


def copy_stock_to_home(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    for product in Product.objects.all():
        total = product.stock_quantity or 0
        if product.warehouse == "WAREHOUSE_1":
            product.stock_quantity_w1 = total
            product.stock_quantity_w2 = 0
        else:
            product.stock_quantity_w1 = 0
            product.stock_quantity_w2 = total
        product.save(update_fields=["stock_quantity_w1", "stock_quantity_w2"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="stock_quantity_w1",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="product",
            name="stock_quantity_w2",
            field=models.IntegerField(default=0),
        ),
        migrations.RunPython(copy_stock_to_home, migrations.RunPython.noop),
        migrations.CreateModel(
            name="StockTransferRequest",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("quantity", models.IntegerField()),
                (
                    "from_warehouse",
                    models.CharField(
                        choices=[("WAREHOUSE_1", "Warehouse 1"), ("WAREHOUSE_2", "Warehouse 2")],
                        max_length=20,
                    ),
                ),
                (
                    "to_warehouse",
                    models.CharField(
                        choices=[("WAREHOUSE_1", "Warehouse 1"), ("WAREHOUSE_2", "Warehouse 2")],
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="stock_transfers",
                        to="catalog.product",
                    ),
                ),
                (
                    "requested_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="stock_transfer_requests",
                        to="accounts.user",
                    ),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="stock_transfer_reviews",
                        to="accounts.user",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
