from django.contrib import admin

from orders.models import AccountingReset, BtcInvoice, ContactMessage, FulfillmentRequest, Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("name", "sku", "unit_price", "quantity", "line_total", "warehouse")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "warehouse",
        "status",
        "payment_status",
        "grand_total",
        "customer_email",
        "created_at",
    )
    list_filter = ("status", "payment_status", "warehouse")
    search_fields = ("order_number", "customer_email", "customer_name", "group_id")
    inlines = [OrderItemInline]


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "name", "email", "created_at")
    search_fields = ("subject", "name", "email")


@admin.register(AccountingReset)
class AccountingResetAdmin(admin.ModelAdmin):
    list_display = ("tile_key", "period", "warehouse", "reset_at")


@admin.register(FulfillmentRequest)
class FulfillmentRequestAdmin(admin.ModelAdmin):
    list_display = ("order", "quantity", "from_warehouse", "to_warehouse", "status", "created_at")
    list_filter = ("status", "from_warehouse", "to_warehouse")


@admin.register(BtcInvoice)
class BtcInvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_id", "order", "status", "amount", "created_at")
    search_fields = ("invoice_id", "order__order_number")
    list_filter = ("status",)
