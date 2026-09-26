from django.db import connection
from django.http import JsonResponse


def health(_request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"ok": True, "database": "up"})
    except Exception:
        return JsonResponse({"ok": False, "database": "down"}, status=503)
