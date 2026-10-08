from rest_framework import serializers

from cms.email_wrapper import DEFAULT_WRAPPER_HTML
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


class PageSerializer(serializers.ModelSerializer):
    isPublished = serializers.BooleanField(source="is_published")
    sortOrder = serializers.IntegerField(source="sort_order", required=False)
    lede = serializers.CharField(allow_blank=True, required=False)
    body = serializers.CharField(allow_blank=True, required=False)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Page
        fields = ["id", "slug", "title", "lede", "body", "isPublished", "sortOrder", "updatedAt"]


class BannerSerializer(serializers.ModelSerializer):
    subtitle = serializers.CharField(allow_blank=True, required=False)
    image = serializers.CharField(allow_blank=True, required=False)
    href = serializers.CharField(allow_blank=True, required=False)
    ctaLabel = serializers.CharField(source="cta_label", allow_blank=True, required=False)
    isActive = serializers.BooleanField(source="is_active", required=False)
    sortOrder = serializers.IntegerField(source="sort_order", required=False)
    bgColorMode = serializers.CharField(source="bg_color_mode", required=False)
    textColorMode = serializers.CharField(source="text_color_mode", required=False)

    class Meta:
        model = Banner
        fields = [
            "id",
            "title",
            "subtitle",
            "image",
            "href",
            "ctaLabel",
            "isActive",
            "sortOrder",
            "bgColorMode",
            "textColorMode",
        ]


class FAQSerializer(serializers.ModelSerializer):
    isPublished = serializers.BooleanField(source="is_published", required=False)
    sortOrder = serializers.IntegerField(source="sort_order", required=False)

    class Meta:
        model = FAQItem
        fields = ["id", "section", "question", "answer", "isPublished", "sortOrder"]


class NavigationSerializer(serializers.ModelSerializer):
    sortOrder = serializers.IntegerField(source="sort_order")
    isActive = serializers.BooleanField(source="is_active")

    class Meta:
        model = NavigationLink
        fields = ["id", "label", "href", "location", "sortOrder", "isActive"]


class SettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ["key", "value", "label", "group"]


class MediaSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ["id", "file", "url", "alt", "createdAt"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class EmailSettingsSerializer(serializers.ModelSerializer):
    enabled = serializers.BooleanField(required=False)
    smtpHost = serializers.CharField(source="smtp_host", allow_blank=True, required=False)
    smtpPort = serializers.IntegerField(source="smtp_port", required=False)
    smtpUsername = serializers.CharField(source="smtp_username", allow_blank=True, required=False)
    smtpPassword = serializers.CharField(
        source="smtp_password",
        allow_blank=True,
        required=False,
        write_only=True,
    )
    hasPassword = serializers.SerializerMethodField()
    useTls = serializers.BooleanField(source="use_tls", required=False)
    useSsl = serializers.BooleanField(source="use_ssl", required=False)
    fromEmail = serializers.EmailField(source="from_email", allow_blank=True, required=False)
    fromName = serializers.CharField(source="from_name", allow_blank=True, required=False)
    bulkSmtpHost = serializers.CharField(source="bulk_smtp_host", allow_blank=True, required=False)
    bulkSmtpPort = serializers.IntegerField(source="bulk_smtp_port", required=False)
    bulkSmtpUsername = serializers.CharField(
        source="bulk_smtp_username", allow_blank=True, required=False
    )
    bulkSmtpPassword = serializers.CharField(
        source="bulk_smtp_password",
        allow_blank=True,
        required=False,
        write_only=True,
    )
    hasBulkPassword = serializers.SerializerMethodField()
    bulkUseTls = serializers.BooleanField(source="bulk_use_tls", required=False)
    bulkUseSsl = serializers.BooleanField(source="bulk_use_ssl", required=False)
    bulkFromEmail = serializers.EmailField(source="bulk_from_email", allow_blank=True, required=False)
    bulkFromName = serializers.CharField(source="bulk_from_name", allow_blank=True, required=False)
    fallbackTransactionalToBulk = serializers.BooleanField(
        source="fallback_transactional_to_bulk", required=False
    )
    extraAdminEmails = serializers.CharField(
        source="extra_admin_emails", allow_blank=True, required=False
    )
    warehouse1Emails = serializers.CharField(
        source="warehouse_1_emails", allow_blank=True, required=False
    )
    warehouse2Emails = serializers.CharField(
        source="warehouse_2_emails", allow_blank=True, required=False
    )
    wrapperHtml = serializers.CharField(
        source="wrapper_html", allow_blank=True, required=False
    )
    defaultWrapperHtml = serializers.SerializerMethodField()

    class Meta:
        model = EmailSettings
        fields = [
            "enabled",
            "smtpHost",
            "smtpPort",
            "smtpUsername",
            "smtpPassword",
            "hasPassword",
            "useTls",
            "useSsl",
            "fromEmail",
            "fromName",
            "bulkSmtpHost",
            "bulkSmtpPort",
            "bulkSmtpUsername",
            "bulkSmtpPassword",
            "hasBulkPassword",
            "bulkUseTls",
            "bulkUseSsl",
            "bulkFromEmail",
            "bulkFromName",
            "fallbackTransactionalToBulk",
            "extraAdminEmails",
            "warehouse1Emails",
            "warehouse2Emails",
            "wrapperHtml",
            "defaultWrapperHtml",
        ]

    def get_hasPassword(self, obj):
        return bool(obj.smtp_password)

    def get_hasBulkPassword(self, obj):
        return bool(obj.bulk_smtp_password)

    def get_defaultWrapperHtml(self, obj):
        return DEFAULT_WRAPPER_HTML

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not (instance.wrapper_html or "").strip():
            data["wrapperHtml"] = DEFAULT_WRAPPER_HTML
        return data

    def update(self, instance, validated_data):
        password = validated_data.pop("smtp_password", None)
        bulk_password = validated_data.pop("bulk_smtp_password", None)
        wrapper = validated_data.get("wrapper_html")
        if wrapper is not None and wrapper.strip() == DEFAULT_WRAPPER_HTML.strip():
            validated_data["wrapper_html"] = ""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.smtp_password = password
        if bulk_password:
            instance.bulk_smtp_password = bulk_password
        instance.save()
        return instance


class EmailTemplateSerializer(serializers.ModelSerializer):
    eventKey = serializers.SlugField(source="event_key", required=False)
    description = serializers.CharField(allow_blank=True, required=False)
    subject = serializers.CharField(required=False)
    body = serializers.CharField(required=False)
    enabled = serializers.BooleanField(required=False)
    notifyAdmin = serializers.BooleanField(source="notify_admin", required=False)
    notifyUser = serializers.BooleanField(source="notify_user", required=False)
    notifyWarehouseManager = serializers.BooleanField(
        source="notify_warehouse_manager", required=False
    )
    customEmails = serializers.CharField(source="custom_emails", allow_blank=True, required=False)
    sortOrder = serializers.IntegerField(source="sort_order", required=False)

    class Meta:
        model = EmailTemplate
        fields = [
            "id",
            "eventKey",
            "name",
            "description",
            "subject",
            "body",
            "enabled",
            "notifyAdmin",
            "notifyUser",
            "notifyWarehouseManager",
            "customEmails",
            "sortOrder",
        ]


class WarehouseSettingsSerializer(serializers.ModelSerializer):
    splitEnabled = serializers.BooleanField(source="split_enabled")
    autoSplitEnabled = serializers.BooleanField(source="auto_split_enabled")
    manualMoveEnabled = serializers.BooleanField(source="manual_move_enabled")
    warehouseRequestEnabled = serializers.BooleanField(source="warehouse_request_enabled")
    w1Name = serializers.CharField(source="w1_name", required=False, allow_blank=True)
    w1Contact = serializers.CharField(source="w1_contact", required=False, allow_blank=True)
    w1Notes = serializers.CharField(source="w1_notes", required=False, allow_blank=True)
    w2Name = serializers.CharField(source="w2_name", required=False, allow_blank=True)
    w2Contact = serializers.CharField(source="w2_contact", required=False, allow_blank=True)
    w2Notes = serializers.CharField(source="w2_notes", required=False, allow_blank=True)

    class Meta:
        model = WarehouseSettings
        fields = [
            "splitEnabled",
            "autoSplitEnabled",
            "manualMoveEnabled",
            "warehouseRequestEnabled",
            "w1Name",
            "w1Contact",
            "w1Notes",
            "w2Name",
            "w2Contact",
            "w2Notes",
        ]
