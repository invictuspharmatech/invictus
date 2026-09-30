import uuid

from django.conf import settings
from django.db import models

from catalog.models import Product


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ON_HOLD = "ON_HOLD", "On hold"
        PAID = "PAID", "Paid"
        PROCESSING = "PROCESSING", "Processing"
        SHIPPED = "SHIPPED", "Shipped"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"
        FAILED = "FAILED", "Failed"

    class Warehouse(models.TextChoices):
        WAREHOUSE_1 = "WAREHOUSE_1", "Warehouse 1"
        WAREHOUSE_2 = "WAREHOUSE_2", "Warehouse 2"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"
        PARTIAL = "PARTIAL", "Partial"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=64, unique=True)
    group_id = models.CharField(max_length=64)
    split_index = models.IntegerField(default=1)
    warehouse = models.CharField(max_length=20, choices=Warehouse.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    payment_method = models.CharField(max_length=20, default="btc")
    merchandise_total = models.FloatField()
    shipping_total = models.FloatField()
    grand_total = models.FloatField()
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    shipping_line1 = models.CharField(max_length=255)
    shipping_line2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=120)
    shipping_state = models.CharField(max_length=120)
    shipping_postal = models.CharField(max_length=40)
    shipping_country = models.CharField(max_length=8, default="US")
    notes = models.TextField(blank=True)
    affiliate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="referred_orders",
    )
    commission_amount = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.order_number

    @property
    def btc_invoice(self):
        return self.btc_invoices.order_by("-created_at").first()


class BtcInvoice(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        PAID = "paid", "Paid"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETE = "complete", "Complete"
        EXPIRED = "expired", "Expired"
        INVALID = "invalid", "Invalid"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="btc_invoices")
    invoice_id = models.CharField(max_length=120, unique=True)
    store_id = models.CharField(max_length=120, blank=True)
    amount = models.FloatField()
    currency = models.CharField(max_length=12, default="USD")
    crypto_code = models.CharField(max_length=40, blank=True)
    crypto_amount = models.CharField(max_length=80, blank=True)
    payment_address = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, default=Status.NEW)
    expires_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    btc_pay_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.invoice_id

    def is_checkout_closed(self) -> bool:
        from datetime import timedelta

        from django.utils import timezone

        started = self.order.created_at if self.order_id else self.created_at
        if started and started <= timezone.now() - timedelta(hours=24):
            return True
        status = (self.status or "").lower()
        if status in ("complete", "paid", "confirmed", "settled"):
            return False
        if status in ("expired", "invalid", "failed"):
            return True
        if self.expires_at and self.expires_at <= timezone.now():
            return True
        return False

    def checkout_link(self) -> str | None:
        if self.is_checkout_closed():
            return None
        data = self.btc_pay_response if isinstance(self.btc_pay_response, dict) else {}
        link = data.get("checkoutLink")
        if isinstance(link, str) and link.strip():
            return link.strip()
        return None


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=120, blank=True)
    unit_price = models.FloatField()
    quantity = models.IntegerField()
    line_total = models.FloatField()
    warehouse = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.name} × {self.quantity}"


class FulfillmentRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="fulfillment_requests")
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.SET_NULL,
        null=True,
        related_name="fulfillment_requests",
    )
    quantity = models.IntegerField()
    from_warehouse = models.CharField(max_length=20)
    to_warehouse = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    note = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="fulfillment_requests",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fulfillment_reviews",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order.order_number} × {self.quantity}"


class ContactMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.subject} · {self.email}"


class AccountingReset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tile_key = models.CharField(max_length=40)
    period = models.CharField(max_length=12)
    warehouse = models.CharField(max_length=20, default="BOTH")
    reset_at = models.DateTimeField()
    reset_by_id = models.CharField(max_length=64, blank=True)

    class Meta:
        unique_together = ("tile_key", "period", "warehouse")
