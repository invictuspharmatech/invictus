from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from accounts import hs256
from accounts.models import User
from accounts.tokens import session_rejected


class InvictusJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = _read_token(request)
        if not token:
            return None
        try:
            payload = hs256.decode(token, settings.AUTH_SECRET, algorithms=["HS256"])
        except hs256.TokenError as exc:
            raise AuthenticationFailed("Invalid token.") from exc
        user_id = payload.get("id")
        if not user_id:
            raise AuthenticationFailed("Invalid token.")
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if not user:
            raise AuthenticationFailed("User not found.")
        if session_rejected(payload, user):
            raise AuthenticationFailed("Session expired.")
        return (user, token)


def _read_token(request):
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return request.COOKIES.get("invictus_session")
