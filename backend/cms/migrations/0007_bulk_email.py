import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("cms", "0006_warehouse_profiles"),
    ]

    operations = [
        migrations.CreateModel(
            name="BulkEmailDraft",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="bulk_email_draft",
                        serialize=False,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("subject", models.CharField(blank=True, max_length=255)),
                ("title", models.CharField(blank=True, max_length=500)),
                ("body_html", models.TextField(blank=True)),
                ("saved_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="BulkEmailBatch",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("total_count", models.IntegerField(default=0)),
                ("sent_count", models.IntegerField(default=0)),
                ("failed_count", models.IntegerField(default=0)),
                ("last_recipient_email", models.CharField(blank=True, max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("running", "Sending"),
                            ("paused", "Paused"),
                            ("stopped", "Stopped"),
                            ("completed", "Completed"),
                            ("interrupted", "Interrupted"),
                        ],
                        default="running",
                        max_length=32,
                    ),
                ),
                ("subject_preview", models.CharField(blank=True, max_length=255)),
                ("subject_tpl", models.TextField(blank=True)),
                ("title_tpl", models.TextField(blank=True)),
                ("body_tpl", models.TextField(blank=True)),
                ("interval_seconds", models.IntegerField(default=300)),
                ("chunk_size", models.IntegerField(default=20)),
                ("last_error", models.TextField(blank=True)),
                ("next_send_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bulk_email_batches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="BulkEmailRecipient",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("sort_order", models.IntegerField(default=0)),
                ("email", models.CharField(max_length=255)),
                ("name", models.CharField(blank=True, max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("sent", "Sent"), ("failed", "Failed")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("error_message", models.TextField(blank=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recipients",
                        to="cms.bulkemailbatch",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "created_at"]},
        ),
        migrations.AlterUniqueTogether(
            name="bulkemailrecipient",
            unique_together={("batch", "email")},
        ),
    ]
