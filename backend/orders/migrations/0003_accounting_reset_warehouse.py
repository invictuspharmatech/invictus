from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_fulfillment_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="accountingreset",
            name="warehouse",
            field=models.CharField(default="BOTH", max_length=20),
        ),
        migrations.AlterUniqueTogether(
            name="accountingreset",
            unique_together={("tile_key", "period", "warehouse")},
        ),
    ]
