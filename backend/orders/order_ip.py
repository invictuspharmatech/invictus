"""Customer checkout IP, one row per order number. Off until a super user turns it on."""

from accounts.client_ip import client_ip
from cms.models import SiteSetting
from orders.models import OrderIpRecord

SETTING_KEY = "security.order_ip_tracking"


def enabled() -> bool:
    row = SiteSetting.objects.filter(pk=SETTING_KEY).first()
    return bool(row and row.value == "on")


def set_enabled(on: bool) -> None:
    SiteSetting.objects.update_or_create(
        key=SETTING_KEY,
        defaults={
            "value": "on" if on else "off",
            "label": "Order IP tracking",
            "group": "security",
        },
    )


def record(order_number: str, request) -> None:
    if not enabled():
        return
    ip = client_ip(request)
    if not ip or not order_number:
        return
    OrderIpRecord.objects.update_or_create(
        order_number=order_number,
        defaults={"ip_address": ip},
    )


def ip_for(order_number: str) -> str | None:
    row = OrderIpRecord.objects.filter(order_number=order_number).first()
    return row.ip_address if row else None


def wash() -> None:
    OrderIpRecord.objects.all().delete()


def count() -> int:
    return OrderIpRecord.objects.count()
