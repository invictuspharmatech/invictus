from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0009_btcpostage_warehouse_accounts"),
    ]

    operations = [
        migrations.AddField(
            model_name="coupon",
            name="usage_limit_per_user",
            field=models.IntegerField(
                blank=True,
                help_text="Max redemptions per customer (user account or email). Blank = unlimited.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="coupon",
            name="stackable_with_other_coupons",
            field=models.BooleanField(
                default=False,
                help_text="Allow combining with other stackable coupons.",
            ),
        ),
        migrations.AddField(
            model_name="coupon",
            name="stackable_coupon_ids",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Partner coupon IDs this code may stack with. Empty = any other stackable coupon.",
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="coupon_code",
            field=models.CharField(
                blank=True,
                help_text="Applied code(s), comma-separated when stacked.",
                max_length=255,
            ),
        ),
    ]
