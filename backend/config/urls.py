from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from config.views import health

admin.site.site_header = "Invictus Pharma CMS"
admin.site.site_title = "Invictus CMS"
admin.site.index_title = "Content and store control"

urlpatterns = [
    path("api/health/", health),
    path(settings.DJANGO_ADMIN_PATH, admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("orders.urls")),
    path("api/", include("cms.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
