from django.urls import path

from cms import views

urlpatterns = [
    path("cms/pages/", views.public_pages),
    path("cms/banners/", views.public_banners),
    path("cms/faq/", views.public_faq),
    path("cms/nav/", views.public_nav),
    path("cms/settings/", views.public_settings),
    path("cms/warehouse-policy/", views.public_warehouse_policy),
    path("admin/cms/pages/", views.admin_pages),
    path("admin/cms/pages/<uuid:pk>/", views.admin_page_detail),
    path("admin/cms/banners/", views.admin_banners),
    path("admin/cms/banners/<uuid:pk>/", views.admin_banner_detail),
    path("admin/cms/faq/", views.admin_faq),
    path("admin/cms/faq/<uuid:pk>/", views.admin_faq_detail),
    path("admin/cms/nav/", views.admin_nav),
    path("admin/cms/nav/<uuid:pk>/", views.admin_nav_detail),
    path("admin/cms/settings/", views.admin_settings),
    path("admin/cms/email-settings/", views.admin_email_settings),
    path("admin/cms/email-templates/", views.admin_email_templates),
    path("admin/cms/email-templates/<uuid:pk>/", views.admin_email_template_detail),
    path("admin/cms/email-test/", views.admin_email_test),
    path("admin/cms/warehouse-settings/", views.admin_warehouse_settings),
]
