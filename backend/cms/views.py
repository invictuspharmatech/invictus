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
    qs = Banner.objects.filter(is_active=True)
    return Response(BannerSerializer(qs, many=True).data)


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
    return _crud(Banner, BannerSerializer, request)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsStoreStaff])
def admin_banner_detail(request, pk):
    return _crud(Banner, BannerSerializer, request, pk)


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
