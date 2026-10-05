from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsStoreStaff
from cms.mailer import ensure_default_templates, get_email_settings, send_test_email
from cms.models import Banner, EmailTemplate, FAQItem, NavigationLink, Page, SiteSetting
from cms.serializers import (
    BannerSerializer,
    EmailSettingsSerializer,
    EmailTemplateSerializer,
    FAQSerializer,
    NavigationSerializer,
    PageSerializer,
    SettingSerializer,
    WarehouseSettingsSerializer,
)
from orders.fulfillment import get_warehouse_settings

BANNERS_ENABLED_KEY = "feature_banners.enabled"
BANNERS_MODE_KEY = "feature_banners.display_mode"


def _setting_value(key: str, default: str) -> str:
    row = SiteSetting.objects.filter(key=key).first()
    return (row.value if row else default) or default


def _banners_enabled() -> bool:
    return _setting_value(BANNERS_ENABLED_KEY, "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def _banners_display_mode() -> str:
    mode = _setting_value(BANNERS_MODE_KEY, "marquee").strip().lower()
    return mode if mode in ("marquee", "slider") else "marquee"


def _set_setting(key: str, value: str, label: str, group: str = "banners") -> None:
    SiteSetting.objects.update_or_create(
        key=key,
        defaults={"value": value, "label": label, "group": group},
    )


def _banner_runtime() -> dict:
    return {"enabled": _banners_enabled(), "displayMode": _banners_display_mode()}


def _alive_banners():
    return Banner.objects.filter(deleted_at__isnull=True)


def _trashed_banners():
    return Banner.objects.filter(deleted_at__isnull=False)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_pages(request):
    slug = request.GET.get("slug")
    qs = Page.objects.filter(is_published=True)
    if slug:
        page = qs.filter(slug=slug).first()
        if not page:
            return Response({"error": "Not found."}, status=404)
        return Response(PageSerializer(page).data)
    return Response(PageSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_banners(request):
    runtime = _banner_runtime()
    qs = _alive_banners().filter(is_active=True) if runtime["enabled"] else _alive_banners().none()
    return Response(
        {
            "items": BannerSerializer(qs, many=True).data,
            **runtime,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def public_faq(request):
    qs = FAQItem.objects.filter(is_published=True)
    return Response(FAQSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_nav(request):
    qs = NavigationLink.objects.filter(is_active=True)
    return Response(NavigationSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_settings(request):
    return Response(SettingSerializer(SiteSetting.objects.all(), many=True).data)


def _crud(model, serializer_cls, request, pk=None, create_map=None):
    if pk:
        obj = model.objects.filter(pk=pk).first()
        if not obj:
            return Response({"error": "Not found."}, status=404)
        if request.method == "DELETE":
            obj.delete()
            return Response({"ok": True})
        serializer = serializer_cls(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    if request.method == "POST":
        serializer = serializer_cls(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer_cls(model.objects.all(), many=True).data)


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_pages(request):
    return _crud(Page, PageSerializer, request)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_page_detail(request, pk):
    return _crud(Page, PageSerializer, request, pk)


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_banners(request):
    if request.method == "POST":
        serializer = BannerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)
    trashed = request.GET.get("trashed") in ("1", "true", "yes")
    qs = _trashed_banners() if trashed else _alive_banners()
    search = (request.GET.get("search") or "").strip()
    if search:
        qs = qs.filter(title__icontains=search)
    return Response({"items": BannerSerializer(qs, many=True).data, **_banner_runtime()})


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_banner_visibility(request):
    if request.method == "PUT":
        enabled = bool(request.data.get("enabled"))
        _set_setting(BANNERS_ENABLED_KEY, "true" if enabled else "false", "Feature banners enabled")
    return Response(_banner_runtime())


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_banner_display_mode(request):
    if request.method == "PUT":
        mode = str(request.data.get("displayMode") or request.data.get("display_mode") or "").strip()
        if mode not in ("marquee", "slider"):
            return Response({"error": "displayMode must be marquee or slider."}, status=400)
        _set_setting(BANNERS_MODE_KEY, mode, "Feature banners display mode")
    return Response(_banner_runtime())


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_banner_restore(request, pk):
    obj = Banner.objects.filter(pk=pk).first()
    if not obj:
        return Response({"error": "Not found."}, status=404)
    obj.deleted_at = None
    obj.save(update_fields=["deleted_at"])
    return Response(BannerSerializer(obj).data)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_banner_detail(request, pk):
    obj = Banner.objects.filter(pk=pk).first()
    if not obj:
        return Response({"error": "Not found."}, status=404)
    if request.method == "GET":
        return Response(BannerSerializer(obj).data)
    if request.method == "DELETE":
        obj.deleted_at = timezone.now()
        obj.save(update_fields=["deleted_at"])
        return Response({"ok": True})
    serializer = BannerSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_faq(request):
    return _crud(FAQItem, FAQSerializer, request)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_faq_detail(request, pk):
    return _crud(FAQItem, FAQSerializer, request, pk)


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_nav(request):
    return _crud(NavigationLink, NavigationSerializer, request)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_nav_detail(request, pk):
    return _crud(NavigationLink, NavigationSerializer, request, pk)


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_settings(request):
    if request.method == "PUT":
        items = request.data if isinstance(request.data, list) else [request.data]
        saved = []
        for item in items:
            key = item.get("key")
            if not key:
                continue
            obj, _ = SiteSetting.objects.update_or_create(
                key=key,
                defaults={
                    "value": item.get("value") or "",
                    "label": item.get("label") or "",
                    "group": item.get("group") or "general",
                },
            )
            saved.append(obj)
        return Response(SettingSerializer(saved, many=True).data)
    return Response(SettingSerializer(SiteSetting.objects.all(), many=True).data)


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_email_settings(request):
    settings = get_email_settings()
    if request.method == "PUT":
        serializer = EmailSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(EmailSettingsSerializer(settings).data)


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_email_templates(request):
    ensure_default_templates()
    qs = EmailTemplate.objects.all()
    return Response(EmailTemplateSerializer(qs, many=True).data)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsStoreStaff])
def admin_email_template_detail(request, pk):
    obj = EmailTemplate.objects.filter(pk=pk).first()
    if not obj:
        return Response({"error": "Not found."}, status=404)
    if request.method == "GET":
        return Response(EmailTemplateSerializer(obj).data)
    serializer = EmailTemplateSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_email_test(request):
    to_email = (request.data.get("to") or request.data.get("email") or "").strip()
    try:
        send_test_email(to_email)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except Exception:
        return Response({"error": "Could not send the test email. Check SMTP settings."}, status=400)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def public_warehouse_policy(request):
    settings_row = get_warehouse_settings()
    return Response(WarehouseSettingsSerializer(settings_row).data)


@api_view(["GET", "PUT"])
@permission_classes([IsStoreStaff])
def admin_warehouse_settings(request):
    settings_row = get_warehouse_settings()
    if request.method == "PUT":
        serializer = WarehouseSettingsSerializer(settings_row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(WarehouseSettingsSerializer(settings_row).data)
