import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailSettings",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("enabled", models.BooleanField(default=False)),
                ("smtp_host", models.CharField(blank=True, max_length=255)),
                ("smtp_port", models.IntegerField(default=587)),
                ("smtp_username", models.CharField(blank=True, max_length=255)),
                ("smtp_password", models.CharField(blank=True, max_length=255)),
                ("use_tls", models.BooleanField(default=True)),
                ("use_ssl", models.BooleanField(default=False)),
                ("from_email", models.EmailField(blank=True, max_length=254)),
                (
                    "from_name",
                    models.CharField(blank=True, default="Invictus Pharma", max_length=160),
                ),
                (
                    "extra_admin_emails",
                    models.TextField(
                        blank=True,
                        help_text="Comma-separated extra admin recipients, in addition to staff accounts.",
                    ),
                ),
                (
                    "warehouse_1_emails",
                    models.TextField(
                        blank=True,
                        help_text="Warehouse 1 manager emails, comma-separated.",
                    ),
                ),
                (
                    "warehouse_2_emails",
                    models.TextField(
                        blank=True,
                        help_text="Warehouse 2 manager emails, comma-separated.",
                    ),
                ),
            ],
            options={
                "verbose_name": "Email settings",
                "verbose_name_plural": "Email settings",
            },
        ),
        migrations.CreateModel(
            name="EmailTemplate",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("event_key", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=160)),
                ("description", models.CharField(blank=True, max_length=400)),
                ("subject", models.CharField(max_length=255)),
                (
                    "body",
                    models.TextField(help_text="HTML allowed. Use {{placeholder}} tokens."),
                ),
                ("enabled", models.BooleanField(default=True)),
                ("notify_admin", models.BooleanField(default=True)),
                ("notify_user", models.BooleanField(default=True)),
                ("notify_warehouse_manager", models.BooleanField(default=False)),
                (
                    "custom_emails",
                    models.TextField(
                        blank=True,
                        help_text="Extra recipients for this notification, comma-separated.",
                    ),
                ),
                ("sort_order", models.IntegerField(default=0)),
            ],
            options={
                "ordering": ["sort_order", "name"],
            },
        ),
    ]
