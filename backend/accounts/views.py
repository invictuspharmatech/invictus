from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.guards import person_name_error
from accounts.models import AffiliateApplication, SessionEpoch, User
from orders.models import ContactIpBlock
from accounts.password_reset import (
    issue_reset_token,
    reset_url_for,
    verify_reset_token,
)
from accounts.permissions import IsAuthenticatedUser, IsStoreStaff, IsSuperuser
from accounts.tokens import issue_token, session_payload
from accounts.verification import EXPIRES_MINUTES, consume, login_gate, send as send_verification
from accounts.serializers import (
    AffiliateApplicationSerializer,
    SessionUserSerializer,
    UserAdminSerializer,
)
from cms.mailer import send_event
from orders.shop_config import apply_affiliate_defaults

_PASSWORD_RESET_OK = (
    "If an account exists for that email, a password reset link has been sent."
)


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
    if not user.is_active and user.email_verified_at is None:
        gate = login_gate(user)
        if gate == "locked":
            return Response(
                {"error": "Contact admin for account activation.", "code": "verification_locked"},
                status=422,
            )
        if gate == "pending":
            return Response(
                {
                    "error": (
                        "Check your email. The verification link is still valid and expires in "
                        f"{EXPIRES_MINUTES} minutes."
                    ),
                    "code": "email_unverified_pending",
                },
                status=422,
            )
        return Response(
            {"error": "Send a verification token again.", "code": "email_unverified"},
            status=422,
        )
    if not user.is_active:
        return Response({"error": "This account is inactive. Contact support."}, status=403)
    token = issue_token(user)
    redirect = "/admin" if user.is_portal_staff else "/account"
    return Response({"ok": True, "token": token, "user": session_payload(user), "redirect": redirect})


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    email = (request.data.get("email") or "").strip().lower()
    name = (request.data.get("name") or "").strip()
    password = request.data.get("password") or ""
    confirm = (
        request.data.get("passwordConfirmation")
        or request.data.get("password_confirmation")
        or ""
    )
    if not email or not name or len(password) < 8:
        return Response(
            {"error": "Name, email, and an 8+ character password are required."},
            status=400,
        )
    if password != confirm:
        return Response({"error": "Passwords do not match."}, status=400)
    name_error = person_name_error(name)
    if name_error:
        return Response({"error": name_error}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({"error": "An account with that email already exists."}, status=409)
    referred_by = None
    ref = request.data.get("referralCode") or request.COOKIES.get("invictus-ref")
    if ref:
        referred_by = User.objects.filter(affiliate_code=ref, is_affiliate=True).first()
    user = User.objects.create_user(
        email=email,
        name=name,
        password=password,
        referred_by=referred_by,
        is_active=False,
    )
    user.email_verified_at = None
    user.email_verification_sends = 0
    update_fields = ["email_verified_at", "email_verification_sends"]
    wants_launch = bool(
        request.data.get("launchNotify")
        or request.data.get("launch_notify")
        or request.data.get("notifyLaunch")
    )
    if wants_launch:
        user.launch_notify = True
        user.launch_notify_at = timezone.now()
        update_fields.extend(["launch_notify", "launch_notify_at"])
    user.save(update_fields=update_fields)
    sent = send_verification(user)
    return Response(
        {
            "ok": True,
            "verification_required": True,
            "email_sent": sent,
            "message": (
                f"Account created. Open the verification link sent to {user.email}. "
                f"It expires in {EXPIRES_MINUTES} minutes. The account stays inactive until then."
                if sent
                else "Account created, but the verification email could not be sent. Try signing in to send it again."
            ),
        }
    )


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
    name_error = person_name_error(name)
    if name_error:
        return Response({"error": name_error}, status=400)
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
def launch_notify_view(request):
    user = request.user
    if user.launch_notify:
        return Response(
            {
                "ok": True,
                "already": True,
                "message": "You are already on the launch notice list.",
                "user": session_payload(user),
            }
        )
    user.launch_notify = True
    user.launch_notify_at = timezone.now()
    user.save(update_fields=["launch_notify", "launch_notify_at"])
    return Response(
        {
            "ok": True,
            "already": False,
            "message": "You will get an email when Invictus launches.",
            "user": session_payload(user),
            "token": issue_token(user),
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password_view(request):
    email = (request.data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return Response({"error": "A valid email is required."}, status=400)
    user = User.objects.filter(email=email, is_active=True).first()
    if user:
        token = issue_reset_token(user)
        send_event(
            "password_reset",
            {
                "user_name": user.name or user.email,
                "user_email": user.email,
                "reset_url": reset_url_for(user, token=token),
                "expires_minutes": 15,
            },
            user_email=user.email,
        )
    return Response({"ok": True, "message": _PASSWORD_RESET_OK})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_view(request):
    token = (request.data.get("token") or "").strip()
    password = request.data.get("password") or ""
    confirm = (
        request.data.get("passwordConfirmation")
        or request.data.get("password_confirmation")
        or ""
    )
    if not token:
        return Response({"error": "Reset token is required."}, status=400)
    if password != confirm:
        return Response({"error": "New passwords do not match."}, status=400)
    if len(password) < 8:
        return Response({"error": "An 8+ character password is required."}, status=400)
    user = verify_reset_token(token)
    if not user:
        return Response(
            {"error": "This reset link is invalid or has expired. Request a new one."},
            status=400,
        )
    user.set_password(password)
    user.save(update_fields=["password"])
    session = issue_token(user)
    return Response({"ok": True, "token": session, "user": session_payload(user)})


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
    name_error = person_name_error(name)
    if name_error:
        return name_error
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
    if user.is_active and user.email_verified_at is None:
        user.email_verified_at = timezone.now()
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


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email_view(request):
    result = consume(request.data.get("token") or "", request.data.get("email") or "")
    if result == "verified":
        return Response({"ok": True, "message": "Email verified. You can sign in."})
    if result == "inactive":
        return Response({"error": "This account is inactive. Contact support."}, status=403)
    if result == "expired":
        return Response({"error": "This verification link has expired. Sign in to send another."}, status=400)
    return Response({"error": "This verification link is invalid."}, status=400)


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification_view(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    user = User.objects.filter(email=email).first()
    if not user or not user.check_password(password):
        return Response({"error": "Email and password do not match."}, status=401)
    if user.email_verified_at and user.is_active:
        return Response({"error": "This account is already verified. Sign in."}, status=400)
    if user.email_verified_at and not user.is_active:
        return Response({"error": "This account is inactive. Contact support."}, status=403)
    gate = login_gate(user)
    if gate == "locked":
        return Response({"error": "Contact admin for account activation.", "code": "verification_locked"}, status=422)
    if gate == "pending":
        return Response(
            {
                "error": f"Check your email. The verification link is still valid and expires in {EXPIRES_MINUTES} minutes.",
                "code": "email_unverified_pending",
            },
            status=422,
        )
    sent = send_verification(user)
    if not sent:
        return Response({"error": "Could not send a verification email. Try again."}, status=503)
    return Response(
        {
            "ok": True,
            "message": f"A new verification link was sent. It expires in {EXPIRES_MINUTES} minutes.",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticatedUser])
def touch_view(request):
    return Response({"ok": True, "token": issue_token(request.user)})


@api_view(["POST"])
@permission_classes([IsSuperuser])
def logout_user_view(request, pk):
    user = User.objects.filter(pk=pk).first()
    if not user:
        return Response({"error": "Not found."}, status=404)
    user.session_version = int(user.session_version or 0) + 1
    user.save(update_fields=["session_version"])
    self_logout = str(request.user.pk) == str(user.pk)
    return Response(
        {
            "ok": True,
            "logged_out_self": self_logout,
            "message": "You have been signed out. Sign in again."
            if self_logout
            else "That user must sign in again.",
        }
    )


@api_view(["POST"])
@permission_classes([IsSuperuser])
def logout_all_view(request):
    epoch, _ = SessionEpoch.objects.get_or_create(pk=1, defaults={"version": 0})
    epoch.version = int(epoch.version or 0) + 1
    epoch.save(update_fields=["version"])
    return Response(
        {
            "ok": True,
            "logged_out_self": True,
            "message": "Every signed-in user must sign in again.",
        }
    )


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def contact_ip_blocks_view(request):
    rows = ContactIpBlock.objects.filter(blocked_at__isnull=False).order_by("-blocked_at")
    return Response(
        {
            "ok": True,
            "data": [
                {
                    "id": row.id,
                    "ip_address": row.ip_address,
                    "rejected_count": row.rejected_count,
                    "blocked_at": row.blocked_at,
                }
                for row in rows
            ],
        }
    )


@api_view(["DELETE"])
@permission_classes([IsStoreStaff])
def contact_ip_block_delete_view(request, pk):
    row = ContactIpBlock.objects.filter(pk=pk, blocked_at__isnull=False).first()
    if not row:
        return Response({"error": "Not found."}, status=404)
    row.delete()
    return Response({"ok": True, "message": "Contact form block removed."})


def uuid_code():
    import secrets

    return secrets.token_hex(3).upper()
