from rest_framework.permissions import BasePermission

ADMIN_ROLES = ("ADMIN", "SUPERUSER")
WAREHOUSE_ROLES = ("WAREHOUSE_1", "WAREHOUSE_2")
PORTAL_ROLES = ADMIN_ROLES + WAREHOUSE_ROLES


def is_full_admin(user) -> bool:
    return bool(user and user.is_authenticated and getattr(user, "role", None) in ADMIN_ROLES)


def is_portal_staff(user) -> bool:
    return bool(user and user.is_authenticated and getattr(user, "role", None) in PORTAL_ROLES)


def managed_warehouse(user) -> str | None:
    role = getattr(user, "role", None)
    if role == "WAREHOUSE_1":
        return "WAREHOUSE_1"
    if role == "WAREHOUSE_2":
        return "WAREHOUSE_2"
    return None


class IsStoreStaff(BasePermission):
    def has_permission(self, request, view):
        return is_full_admin(request.user)


class IsPortalStaff(BasePermission):
    def has_permission(self, request, view):
        return is_portal_staff(request.user)


class IsAuthenticatedUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
