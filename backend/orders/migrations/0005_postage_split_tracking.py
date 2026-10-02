from decimal import Decimal

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0004_btcpay"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="tracking_number",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.CreateModel(
            name="RevenueSplitSettings",
            fields=[
                ("id", models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False, serialize=False)),
                ("w1_admin", models.FloatField(default=25)),
                ("w1_party1", models.FloatField(default=60)),
                ("w1_party2", models.FloatField(default=15)),
                ("w2_admin", models.FloatField(default=25)),
                ("w2_party1", models.FloatField(default=0)),
                ("w2_party2", models.FloatField(default=75)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="BitcoinPostageSettings",
            fields=[
                ("id", models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False, serialize=False)),
                ("api_url", models.CharField(default="https://bitcoinpostage.info/api", max_length=255)),
                ("api_key", models.CharField(blank=True, max_length=255)),
                ("api_secret", models.CharField(blank=True, max_length=255)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="BitcoinPostageSender",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("from_name", models.CharField(max_length=160)),
                ("from_street", models.CharField(max_length=255)),
                ("from_apt", models.CharField(blank=True, max_length=120)),
                ("from_city", models.CharField(max_length=120)),
                ("from_state", models.CharField(max_length=80)),
                ("from_zip", models.CharField(max_length=32)),
                ("from_country", models.CharField(default="US", max_length=8)),
                ("from_phone", models.CharField(blank=True, max_length=64)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-is_default", "from_name"]},
        ),
        migrations.CreateModel(
            name="ShippingLabel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tracking_number", models.CharField(blank=True, max_length=120)),
                ("tracking_url", models.CharField(blank=True, max_length=500)),
                ("label_url", models.CharField(blank=True, max_length=700)),
                ("carrier", models.CharField(blank=True, max_length=40)),
                ("service_type", models.CharField(blank=True, max_length=80)),
                (
                    "source",
                    models.CharField(
                        choices=[("btcpostage", "Bitcoin Postage"), ("manual", "Manual")],
                        default="btcpostage",
                        max_length=20,
                    ),
                ),
                ("raw", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="shipping_labels",
                        to="orders.order",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
