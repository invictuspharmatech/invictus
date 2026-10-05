import uuid

from django.conf import settings
from django.db import models

from catalog.models import Product


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = "PERCENT", "Percent off"
        FIXED = "FIXED", "Fixed amount"
        FREE_SHIPPING = "FREE_SHIPPING", "Free shipping"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENT,
    )
    amount = models.FloatField(default=0)
    minimum_amount = models.FloatField(default=0)
    usage_limit = models.IntegerField(null=True, blank=True)
    used_count = models.IntegerField(default=0)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ON_HOLD = "ON_HOLD", "On hold"
        PROCESSING = "PROCESSING", "Processing"
        PARTIALLY_FILLED = "PARTIALLY_FILLED", "Partially filled"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        REFUNDED = "REFUNDED", "Refunded"
        FAILED = "FAILED", "Failed"
        PAID = "PAID", "Paid"
        SHIPPED = "SHIPPED", "Shipped"
        DELIVERED = "DELIVERED", "Delivered"

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
    coupon = models.ForeignKey(
        Coupon,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    coupon_code = models.CharField(max_length=64, blank=True)
    discount_total = models.FloatField(default=0)
    shipping_waived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    tracking_number = models.CharField(max_length=120, blank=True)

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


class RevenueSplitSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    w1_admin = models.FloatField(default=25)
    w1_party1 = models.FloatField(default=60)
    w1_party2 = models.FloatField(default=15)
    w2_admin = models.FloatField(default=25)
    w2_party1 = models.FloatField(default=0)
    w2_party2 = models.FloatField(default=75)
    updated_at = models.DateTimeField(auto_now=True)

    def as_percents(self) -> dict:
        return {
            "w1Admin": self.w1_admin,
            "w1Party1": self.w1_party1,
            "w1Party2": self.w1_party2,
            "w2Admin": self.w2_admin,
            "w2Party1": self.w2_party1,
            "w2Party2": self.w2_party2,
        }


class BitcoinPostageSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    api_url = models.CharField(max_length=255, default="https://bitcoinpostage.info/api")
    api_key = models.CharField(max_length=255, blank=True)
    api_secret = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class BitcoinPostageSender(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_name = models.CharField(max_length=160)
    from_street = models.CharField(max_length=255)
    from_apt = models.CharField(max_length=120, blank=True)
    from_city = models.CharField(max_length=120)
    from_state = models.CharField(max_length=80)
    from_zip = models.CharField(max_length=32)
    from_country = models.CharField(max_length=8, default="US")
    from_phone = models.CharField(max_length=64, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "from_name"]


class ShippingLabel(models.Model):
    class Source(models.TextChoices):
        BTCPOSTAGE = "btcpostage", "Bitcoin Postage"
        MANUAL = "manual", "Manual"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="shipping_labels")
    tracking_number = models.CharField(max_length=120, blank=True)
    tracking_url = models.CharField(max_length=500, blank=True)
    label_url = models.CharField(max_length=700, blank=True)
    carrier = models.CharField(max_length=40, blank=True)
    service_type = models.CharField(max_length=80, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.BTCPOSTAGE)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
