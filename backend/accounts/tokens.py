import time

import jwt
from django.conf import settings

from accounts.models import User


def issue_token(user: User) -> str:
    now = int(time.time())
    payload = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "isAffiliate": user.is_affiliate,
        "affiliateCode": user.affiliate_code,
        "iat": now,
        "exp": now + settings.JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.AUTH_SECRET, algorithm="HS256")


def session_payload(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "isAffiliate": user.is_affiliate,
        "affiliateCode": user.affiliate_code,
    }
