from django.contrib import admin

from cms.models import (
    Banner,
    EmailSettings,
    EmailTemplate,
    FAQItem,
    MediaAsset,
    NavigationLink,
    Page,
    SiteSetting,
    WarehouseSettings,
)


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "is_published", "updated_at")
    list_filter = ("is_published",)
    search_fields = ("title", "slug", "body")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "sort_order")
    list_filter = ("is_active",)


@admin.register(FAQItem)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "section", "is_published", "sort_order")
    list_filter = ("section", "is_published")
    search_fields = ("question", "answer")


@admin.register(NavigationLink)
class NavigationAdmin(admin.ModelAdmin):
    list_display = ("label", "location", "href", "is_active", "sort_order")
    list_filter = ("location", "is_active")


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "group", "value")
    list_filter = ("group",)


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("alt", "file", "created_at")


@admin.register(EmailSettings)
class EmailSettingsAdmin(admin.ModelAdmin):
    list_display = ("from_email", "smtp_host", "enabled")


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "event_key",
        "enabled",
        "notify_admin",
        "notify_user",
        "notify_warehouse_manager",
    )
    list_filter = ("enabled", "notify_admin", "notify_user", "notify_warehouse_manager")
    search_fields = ("name", "event_key", "subject")


@admin.register(WarehouseSettings)
class WarehouseSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "split_enabled",
        "auto_split_enabled",
        "manual_move_enabled",
        "warehouse_request_enabled",
    )
