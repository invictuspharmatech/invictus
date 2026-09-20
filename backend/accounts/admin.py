from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from accounts.models import AffiliateApplication, User


class InvictusUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("email", "name", "role")


class InvictusUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = (
            "email",
            "name",
            "role",
            "phone",
            "is_affiliate",
            "affiliate_code",
            "commission_type",
            "commission_rate",
            "payout_type",
            "is_active",
            "is_staff",
        )


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = InvictusUserCreationForm
    form = InvictusUserChangeForm
    model = User
    list_display = ("email", "name", "role", "is_affiliate", "is_active")
    list_filter = ("role", "is_affiliate", "is_active")
    search_fields = ("email", "name")
    ordering = ("email",)
    filter_horizontal = ()
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("name", "role", "phone")}),
        (
            "Affiliate",
            {
                "fields": (
                    "is_affiliate",
                    "affiliate_code",
                    "commission_type",
                    "commission_rate",
                    "payout_type",
                    "referred_by",
                )
            },
        ),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "name", "role", "password1", "password2"),
            },
        ),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if getattr(request.user, "role", None) != User.Role.SUPERUSER:
            qs = qs.exclude(role=User.Role.SUPERUSER)
        return qs


@admin.register(AffiliateApplication)
class AffiliateApplicationAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "created_at")
    list_filter = ("status",)
