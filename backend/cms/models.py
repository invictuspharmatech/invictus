import uuid

from django.db import models


class Page(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, max_length=160)
    title = models.CharField(max_length=255)
    lede = models.TextField(blank=True)
    body = models.TextField(help_text="HTML allowed. Shown on the storefront.")
    is_published = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "title"]

    def __str__(self):
        return self.title


class Banner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    subtitle = models.TextField(blank=True)
    image = models.CharField(max_length=700, blank=True)
    href = models.CharField(max_length=300, blank=True)
    cta_label = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "title"]

    def __str__(self):
        return self.title


class FAQItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.CharField(max_length=160)
    question = models.CharField(max_length=400)
    answer = models.TextField()
    is_published = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "question"]
        verbose_name = "FAQ item"

    def __str__(self):
        return self.question


class NavigationLink(models.Model):
    class Location(models.TextChoices):
        HEADER = "header", "Header"
        FOOTER_PRODUCTS = "footer_products", "Footer · Products"
        FOOTER_COMPANY = "footer_company", "Footer · Company"
        FOOTER_RESOURCES = "footer_resources", "Footer · Resources"
        FOOTER_POLICIES = "footer_policies", "Footer · Policies"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=120)
    href = models.CharField(max_length=300)
    location = models.CharField(max_length=40, choices=Location.choices)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["location", "sort_order", "label"]

    def __str__(self):
        return f"{self.location}: {self.label}"


class SiteSetting(models.Model):
    key = models.CharField(max_length=80, primary_key=True)
    value = models.TextField(blank=True)
    label = models.CharField(max_length=160, blank=True)
    group = models.CharField(max_length=40, default="general")

    class Meta:
        ordering = ["group", "key"]

    def __str__(self):
        return self.key


class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to="cms/")
    alt = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.alt or self.file.name


class EmailSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    enabled = models.BooleanField(default=False)
    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.IntegerField(default=587)
    smtp_username = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    from_email = models.EmailField(blank=True)
    from_name = models.CharField(max_length=160, blank=True, default="Invictus Pharma")
    extra_admin_emails = models.TextField(
        blank=True,
        help_text="Comma-separated extra admin recipients, in addition to staff accounts.",
    )
    warehouse_1_emails = models.TextField(
        blank=True,
        help_text="Warehouse 1 manager emails, comma-separated.",
    )
    warehouse_2_emails = models.TextField(
        blank=True,
        help_text="Warehouse 2 manager emails, comma-separated.",
    )

    class Meta:
        verbose_name = "Email settings"
        verbose_name_plural = "Email settings"

    def save(self, *args, **kwargs):
        self.id = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "Email settings"


class EmailTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_key = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.CharField(max_length=400, blank=True)
    subject = models.CharField(max_length=255)
    body = models.TextField(help_text="HTML allowed. Use {{placeholder}} tokens.")
    enabled = models.BooleanField(default=True)
    notify_admin = models.BooleanField(default=True)
    notify_user = models.BooleanField(default=True)
    notify_warehouse_manager = models.BooleanField(default=False)
    custom_emails = models.TextField(
        blank=True,
        help_text="Extra recipients for this notification, comma-separated.",
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class WarehouseSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    split_enabled = models.BooleanField(default=False)
    auto_split_enabled = models.BooleanField(default=False)
    manual_move_enabled = models.BooleanField(default=False)
    warehouse_request_enabled = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Warehouse settings"
        verbose_name_plural = "Warehouse settings"

    def save(self, *args, **kwargs):
        self.id = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "Warehouse settings"
