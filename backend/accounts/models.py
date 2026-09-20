from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
import uuid


class InvictusUserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        extra_fields.setdefault("name", extra_fields.get("name") or email.split("@")[0])
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.CUSTOMER)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.SUPERUSER)
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        SUPERUSER = "SUPERUSER", "Super user"
        ADMIN = "ADMIN", "Admin"
        WAREHOUSE_1 = "WAREHOUSE_1", "Warehouse 1"
        WAREHOUSE_2 = "WAREHOUSE_2", "Warehouse 2"
        CUSTOMER = "CUSTOMER", "Customer"

    class CommissionType(models.TextChoices):
        PERCENT = "PERCENT", "Percent"
        FIXED = "FIXED", "Fixed"

    class PayoutType(models.TextChoices):
        COMMISSION = "COMMISSION", "Commission"
        STORE_CREDIT = "STORE_CREDIT", "Store credit"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    phone = models.CharField(max_length=64, blank=True)
    is_affiliate = models.BooleanField(default=False)
    affiliate_code = models.CharField(max_length=32, unique=True, null=True, blank=True)
    commission_type = models.CharField(
        max_length=20, choices=CommissionType.choices, default=CommissionType.PERCENT
    )
    commission_rate = models.FloatField(default=10)
    payout_type = models.CharField(
        max_length=20, choices=PayoutType.choices, default=PayoutType.STORE_CREDIT
    )
    referred_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="referred_users",
    )
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = InvictusUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if self.role == self.Role.SUPERUSER:
            self.is_staff = True
            self.is_superuser = True
        elif self.role in (self.Role.ADMIN, self.Role.WAREHOUSE_1, self.Role.WAREHOUSE_2):
            self.is_staff = True
            self.is_superuser = False
        super().save(*args, **kwargs)

    @property
    def is_store_staff(self):
        return self.role in (self.Role.ADMIN, self.Role.SUPERUSER)

    @property
    def is_warehouse_staff(self):
        return self.role in (self.Role.WAREHOUSE_1, self.Role.WAREHOUSE_2)

    @property
    def is_portal_staff(self):
        return self.is_store_staff or self.is_warehouse_staff

    @property
    def managed_warehouse(self):
        if self.role == self.Role.WAREHOUSE_1:
            return "WAREHOUSE_1"
        if self.role == self.Role.WAREHOUSE_2:
            return "WAREHOUSE_2"
        return None


class AffiliateApplication(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        DECLINED = "declined", "Declined"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="affiliate_applications"
    )
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} · {self.status}"
