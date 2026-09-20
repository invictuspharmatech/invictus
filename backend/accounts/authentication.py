import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from accounts.models import User


class InvictusJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = _read_token(request)
        if not token:
            return None
        try:
            payload = jwt.decode(token, settings.AUTH_SECRET, algorithms=["HS256"])
        except jwt.PyJWTError as exc:
            raise AuthenticationFailed("Invalid token.") from exc
        user_id = payload.get("id")
        if not user_id:
            raise AuthenticationFailed("Invalid token.")
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if not user:
            raise AuthenticationFailed("User not found.")
        return (user, token)


def _read_token(request):
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return request.COOKIES.get("invictus_session")
