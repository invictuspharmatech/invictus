from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0011_order_soft_delete"),
    ]

    operations = [
        migrations.AddField(
            model_name="coupon",
            name="include_shipping_in_discount",
            field=models.BooleanField(
                default=False,
                help_text="If enabled, percent/fixed discounts apply to merchandise + shipping (not merchandise only).",
            ),
        ),
    ]
