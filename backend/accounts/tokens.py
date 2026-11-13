import time

from django.conf import settings

from accounts import hs256
from accounts.models import SessionEpoch, User

IDLE_SECONDS = 15 * 60


def current_epoch() -> int:
    row, _ = SessionEpoch.objects.get_or_create(pk=1, defaults={"version": 0})
    return int(row.version or 0)


def issue_token(user: User) -> str:
    now = int(time.time())
    payload = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "isAffiliate": user.is_affiliate,
        "affiliateCode": user.affiliate_code,
        "sv": int(user.session_version or 0),
        "ev": current_epoch(),
        "act": now,
        "iat": now,
        "exp": now + settings.JWT_TTL_SECONDS,
    }
    return hs256.encode(payload, settings.AUTH_SECRET, algorithm="HS256")


def session_rejected(payload: dict, user: User) -> bool:
    now = int(time.time())
    acted = int(payload.get("act") or payload.get("iat") or 0)
    if acted <= 0 or now - acted > IDLE_SECONDS:
        return True
    if int(payload.get("sv") or 0) != int(user.session_version or 0):
        return True
    if int(payload.get("ev") or 0) != current_epoch():
        return True
    return False


def session_payload(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "isAffiliate": user.is_affiliate,
        "affiliateCode": user.affiliate_code,
        "launchNotify": bool(user.launch_notify),
    }
