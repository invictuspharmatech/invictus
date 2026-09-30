from django.db import migrations, models
import django.db.models.deletion
import uuid


def backfill_paid_orders(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Order.objects.filter(status__in=["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]).update(
        payment_status="PAID"
    )
    Order.objects.filter(status="CANCELLED").update(payment_status="FAILED")


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0003_accounting_reset_warehouse"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(default="btc", max_length=20),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(default="PENDING", max_length=20),
        ),
        migrations.RunPython(backfill_paid_orders, migrations.RunPython.noop),
        migrations.CreateModel(
            name="BtcInvoice",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("invoice_id", models.CharField(max_length=120, unique=True)),
                ("store_id", models.CharField(blank=True, max_length=120)),
                ("amount", models.FloatField()),
                ("currency", models.CharField(default="USD", max_length=12)),
                ("crypto_code", models.CharField(blank=True, max_length=40)),
                ("crypto_amount", models.CharField(blank=True, max_length=80)),
                ("payment_address", models.CharField(blank=True, max_length=255)),
                ("status", models.CharField(default="new", max_length=20)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("btc_pay_response", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="btc_invoices",
                        to="orders.order",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
