from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0005_stock_notifications"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="allow_backorder",
            field=models.BooleanField(default=False),
        ),
    ]
