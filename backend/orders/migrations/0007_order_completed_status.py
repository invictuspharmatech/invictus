from django.db import migrations, models
from django.utils import timezone


def forwards(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Order.objects.filter(status="PAID").update(status="PROCESSING")
    now = timezone.now()
    Order.objects.filter(status__in=["SHIPPED", "DELIVERED"], shipped_at__isnull=True).update(
        shipped_at=now
    )
    Order.objects.filter(status__in=["SHIPPED", "DELIVERED"]).update(status="COMPLETED")


def backwards(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Order.objects.filter(status="COMPLETED").update(status="SHIPPED")


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0006_coupon"),
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
                    ("COMPLETED", "Completed"),
                    ("CANCELLED", "Cancelled"),
                    ("FAILED", "Failed"),
                    ("PAID", "Paid"),
                    ("SHIPPED", "Shipped"),
                    ("DELIVERED", "Delivered"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
