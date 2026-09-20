from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_stock_and_transfers"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="allow_backorder",
            field=models.BooleanField(default=True),
        ),
    ]
