"""Successful sign-in IP log. Off until a super user turns it on."""

from accounts.client_ip import client_ip
from accounts.models import UserLoginIpRecord
from cms.models import SiteSetting

SETTING_KEY = "security.login_ip_tracking"


def enabled() -> bool:
    row = SiteSetting.objects.filter(pk=SETTING_KEY).first()
    return bool(row and row.value == "on")


def set_enabled(on: bool) -> None:
    SiteSetting.objects.update_or_create(
        key=SETTING_KEY,
        defaults={
            "value": "on" if on else "off",
            "label": "Login IP tracking",
            "group": "security",
        },
    )


def record(user, request) -> None:
    if not enabled():
        return
    ip = client_ip(request)
    if not ip:
        return
    UserLoginIpRecord.objects.create(user=user, email=user.email, ip_address=ip)


def for_user(user_id, limit: int = 30) -> dict:
    qs = UserLoginIpRecord.objects.filter(user_id=user_id)
    total = qs.count()
    rows = qs.order_by("-created_at")[:limit]
    return {
        "total": total,
        "records": [
            {"ipAddress": row.ip_address, "loggedInAt": row.created_at.isoformat()}
            for row in rows
        ],
    }


def wash() -> None:
    UserLoginIpRecord.objects.all().delete()


def count() -> int:
    return UserLoginIpRecord.objects.count()
