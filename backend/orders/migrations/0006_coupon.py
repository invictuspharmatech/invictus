import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0005_postage_split_tracking"),
    ]

    operations = [
        migrations.CreateModel(
            name="Coupon",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=255)),
                (
                    "discount_type",
                    models.CharField(
                        choices=[
                            ("PERCENT", "Percent off"),
                            ("FIXED", "Fixed amount"),
                            ("FREE_SHIPPING", "Free shipping"),
                        ],
                        default="PERCENT",
                        max_length=20,
                    ),
                ),
                ("amount", models.FloatField(default=0)),
                ("minimum_amount", models.FloatField(default=0)),
                ("usage_limit", models.IntegerField(blank=True, null=True)),
                ("used_count", models.IntegerField(default=0)),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="order",
            name="coupon",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orders",
                to="orders.coupon",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="coupon_code",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="order",
            name="discount_total",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="order",
            name="shipping_waived",
            field=models.BooleanField(default=False),
        ),
    ]
