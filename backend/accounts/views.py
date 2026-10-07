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
from orders.shop_config import apply_affiliate_defaults


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


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticatedUser])
def me_view(request):
    user = request.user
    if request.method == "GET":
        return Response(SessionUserSerializer(user).data)
    name = (request.data.get("name") or "").strip()
    email = (request.data.get("email") or "").strip().lower()
    if not name or not email:
        return Response({"error": "Name and email are required."}, status=400)
    clash = User.objects.filter(email=email).exclude(pk=user.pk)
    if clash.exists():
        return Response({"error": "An account with that email already exists."}, status=409)
    user.name = name
    user.email = email
    user.save(update_fields=["name", "email"])
    token = issue_token(user)
    return Response({"ok": True, "token": token, "user": session_payload(user)})


@api_view(["POST"])
@permission_classes([IsAuthenticatedUser])
def change_password_view(request):
    user = request.user
    current = request.data.get("currentPassword") or request.data.get("current_password") or ""
    password = request.data.get("password") or ""
    confirm = (
        request.data.get("passwordConfirmation")
        or request.data.get("password_confirmation")
        or ""
    )
    if not user.check_password(current):
        return Response({"error": "Current password is incorrect."}, status=400)
    if password != confirm:
        return Response({"error": "New passwords do not match."}, status=400)
    if len(password) < 8:
        return Response({"error": "An 8+ character password is required."}, status=400)
    user.set_password(password)
    user.save(update_fields=["password"])
    token = issue_token(user)
    return Response({"ok": True, "token": token})


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


ASSIGNABLE_ROLES = {
    User.Role.SUPERUSER,
    User.Role.ADMIN,
    User.Role.WAREHOUSE_1,
    User.Role.WAREHOUSE_2,
    User.Role.CUSTOMER,
}


def _visible_users(actor):
    qs = User.objects.all()
    if actor.role != User.Role.SUPERUSER:
        qs = qs.exclude(role=User.Role.SUPERUSER)
    return qs


def _can_manage_user(actor, target) -> bool:
    if target.role == User.Role.SUPERUSER and actor.role != User.Role.SUPERUSER:
        return False
    return True


def _parse_role(actor, value):
    role = str(value or "").strip().upper()
    if role not in ASSIGNABLE_ROLES:
        return None, "Invalid user type."
    if role == User.Role.SUPERUSER and actor.role != User.Role.SUPERUSER:
        return None, "Only a super user can assign that type."
    return role, None


def _apply_user_fields(user, data, actor, *, creating: bool):
    role, error = _parse_role(actor, data.get("role") or user.role)
    if error:
        return error
    email = (data.get("email") or user.email or "").strip().lower()
    name = (data.get("name") or user.name or "").strip()
    if not email or not name:
        return "Name and email are required."
    clash = User.objects.filter(email=email)
    if not creating:
        clash = clash.exclude(pk=user.pk)
    if clash.exists():
        return "An account with that email already exists."
    password = data.get("password")
    if creating and (not password or len(str(password)) < 8):
        return "An 8+ character password is required."
    if password:
        if len(str(password)) < 8:
            return "An 8+ character password is required."
        user.set_password(password)
    user.email = email
    user.name = name
    user.role = role
    if "isActive" in data:
        user.is_active = bool(data.get("isActive"))
    if "isAffiliate" in data:
        user.is_affiliate = bool(data.get("isAffiliate"))
        if user.is_affiliate and not user.affiliate_code:
            user.affiliate_code = f"INV{uuid_code()}"
            apply_affiliate_defaults(user)
        if not user.is_affiliate:
            user.affiliate_code = user.affiliate_code or None
    user.save()
    return None


@api_view(["GET", "POST"])
@permission_classes([IsStoreStaff])
def admin_users_view(request):
    if request.method == "POST":
        user = User(role=User.Role.CUSTOMER)
        error = _apply_user_fields(user, request.data, request.user, creating=True)
        if error:
            return Response({"error": error}, status=400)
        return Response(UserAdminSerializer(user).data, status=201)
    return Response(UserAdminSerializer(_visible_users(request.user), many=True).data)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsStoreStaff])
def admin_user_detail_view(request, pk):
    user = _visible_users(request.user).filter(pk=pk).first()
    if not user:
        return Response({"error": "Not found."}, status=404)
    if not _can_manage_user(request.user, user):
        return Response({"error": "Not found."}, status=404)
    if request.method == "GET":
        return Response(UserAdminSerializer(user).data)
    error = _apply_user_fields(user, request.data, request.user, creating=False)
    if error:
        return Response({"error": error}, status=400)
    return Response(UserAdminSerializer(user).data)


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
        apply_affiliate_defaults(user)
        user.save(
            update_fields=[
                "is_affiliate",
                "affiliate_code",
                "commission_type",
                "commission_rate",
                "payout_type",
            ]
        )
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
