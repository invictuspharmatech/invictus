from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import AffiliateApplication, User
from accounts.permissions import IsAuthenticatedUser, IsStoreStaff
from accounts.serializers import (
    AffiliateApplicationSerializer,
    SessionUserSerializer,
    UserAdminSerializer,
)
from accounts.tokens import issue_token, session_payload
from cms.mailer import send_event


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    if not email or not password:
        return Response({"error": "Email and password are required."}, status=400)
    user = User.objects.filter(email=email).first()
    if not user or not user.check_password(password):
        return Response({"error": "Invalid credentials."}, status=401)
    token = issue_token(user)
    redirect = "/admin" if user.is_portal_staff else "/account"
    return Response({"ok": True, "token": token, "user": session_payload(user), "redirect": redirect})


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    email = (request.data.get("email") or "").strip().lower()
    name = (request.data.get("name") or "").strip()
    password = request.data.get("password") or ""
    if not email or not name or len(password) < 8:
        return Response(
            {"error": "Name, email, and an 8+ character password are required."},
            status=400,
        )
    if User.objects.filter(email=email).exists():
        return Response({"error": "An account with that email already exists."}, status=409)
    referred_by = None
    ref = request.data.get("referralCode") or request.COOKIES.get("invictus-ref")
    if ref:
        referred_by = User.objects.filter(affiliate_code=ref, is_affiliate=True).first()
    user = User.objects.create_user(
        email=email, name=name, password=password, referred_by=referred_by
    )
    send_event(
        "account_registered",
        {"user_name": user.name, "user_email": user.email},
        user_email=user.email,
    )
    token = issue_token(user)
    return Response({"ok": True, "token": token, "user": session_payload(user)})


@api_view(["GET"])
@permission_classes([IsAuthenticatedUser])
def me_view(request):
    return Response(SessionUserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticatedUser])
def affiliate_apply_view(request):
    user = request.user
    if user.is_affiliate:
        return Response({"error": "Already an affiliate."}, status=400)
    if AffiliateApplication.objects.filter(user=user, status="pending").exists():
        return Response({"error": "Application already pending."}, status=400)
    AffiliateApplication.objects.create(user=user, status="pending")
    send_event(
        "affiliate_applied",
        {"user_name": user.name, "user_email": user.email},
        user_email=user.email,
    )
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_users_view(request):
    qs = User.objects.all()
    if request.user.role != User.Role.SUPERUSER:
        qs = qs.exclude(role=User.Role.SUPERUSER)
    return Response(UserAdminSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def admin_affiliates_view(request):
    qs = AffiliateApplication.objects.select_related("user").all()
    if request.user.role != User.Role.SUPERUSER:
        qs = qs.exclude(user__role=User.Role.SUPERUSER)
    return Response(AffiliateApplicationSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def admin_affiliate_action_view(request, pk):
    application = AffiliateApplication.objects.select_related("user").filter(pk=pk).first()
    if not application:
        return Response({"error": "Not found."}, status=404)
    if (
        application.user.role == User.Role.SUPERUSER
        and request.user.role != User.Role.SUPERUSER
    ):
        return Response({"error": "Not found."}, status=404)
    action = request.data.get("action")
    if action == "approve":
        application.status = AffiliateApplication.Status.APPROVED
        application.save(update_fields=["status"])
        user = application.user
        user.is_affiliate = True
        if not user.affiliate_code:
            user.affiliate_code = f"INV{uuid_code()}"
        user.save(update_fields=["is_affiliate", "affiliate_code"])
        send_event(
            "affiliate_approved",
            {
                "user_name": user.name,
                "user_email": user.email,
                "affiliate_code": user.affiliate_code,
            },
            user_email=user.email,
        )
    else:
        application.status = AffiliateApplication.Status.DECLINED
        application.save(update_fields=["status"])
        send_event(
            "affiliate_declined",
            {"user_name": application.user.name, "user_email": application.user.email},
            user_email=application.user.email,
        )
    return Response({"ok": True})


def uuid_code():
    import secrets

    return secrets.token_hex(3).upper()
