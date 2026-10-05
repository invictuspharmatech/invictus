from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0007_order_completed_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("ON_HOLD", "On hold"),
                    ("PROCESSING", "Processing"),
                    ("PARTIALLY_FILLED", "Partially filled"),
                    ("COMPLETED", "Completed"),
                    ("CANCELLED", "Cancelled"),
                    ("REFUNDED", "Refunded"),
                    ("FAILED", "Failed"),
                    ("PAID", "Paid"),
                    ("SHIPPED", "Shipped"),
                    ("DELIVERED", "Delivered"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
    ]
