import uuid

from django.db import migrations, models


def copy_legacy_settings(apps, schema_editor):
    Settings = apps.get_model("orders", "BitcoinPostageSettings")
    Account = apps.get_model("orders", "BitcoinPostageAccount")
    row = Settings.objects.filter(pk=1).first()
    if not row or not (row.api_key or row.api_secret):
        return
    for warehouse in ("WAREHOUSE_1", "WAREHOUSE_2"):
        Account.objects.get_or_create(
            warehouse=warehouse,
            defaults={
                "id": uuid.uuid4(),
                "name": f"Warehouse {warehouse[-1]} account",
                "api_url": row.api_url or "https://bitcoinpostage.info/api",
                "api_key": row.api_key or "",
                "api_secret": row.api_secret or "",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0008_order_refunded_partial"),
    ]

    operations = [
        migrations.CreateModel(
            name="BitcoinPostageAccount",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "warehouse",
                    models.CharField(
                        choices=[("WAREHOUSE_1", "Warehouse 1"), ("WAREHOUSE_2", "Warehouse 2")],
                        max_length=20,
                        unique=True,
                    ),
                ),
                ("name", models.CharField(blank=True, max_length=120)),
                (
                    "api_url",
                    models.CharField(default="https://bitcoinpostage.info/api", max_length=255),
                ),
                ("api_key", models.CharField(blank=True, max_length=255)),
                ("api_secret", models.CharField(blank=True, max_length=255)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["warehouse"]},
        ),
        migrations.AddField(
            model_name="bitcoinpostagesender",
            name="warehouse",
            field=models.CharField(
                blank=True,
                choices=[("WAREHOUSE_1", "Warehouse 1"), ("WAREHOUSE_2", "Warehouse 2")],
                default="",
                help_text="Optional. When set, preferred for orders from this warehouse.",
                max_length=20,
            ),
        ),
        migrations.RunPython(copy_legacy_settings, migrations.RunPython.noop),
    ]
