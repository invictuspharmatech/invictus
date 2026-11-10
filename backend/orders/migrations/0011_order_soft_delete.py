from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0010_coupon_stack_and_per_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="deleted_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
