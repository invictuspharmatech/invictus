from django.urls import path

from catalog import views

urlpatterns = [
    path("categories/", views.category_list),
    path("products/", views.product_list),
    path("products/<slug:slug>/", views.product_detail),
    path("test-results/", views.test_result_list),
    path("admin/products/", views.admin_product_list),
    path("admin/products/<uuid:pk>/", views.admin_product_detail),
    path("admin/products/<uuid:pk>/warehouse/", views.admin_product_warehouse),
    path("admin/test-results/", views.admin_test_results),
    path("admin/test-results/<uuid:pk>/", views.admin_test_result_detail),
    path("admin/stock-transfers/", views.admin_stock_transfers),
    path("admin/stock-transfers/<uuid:pk>/review/", views.admin_stock_transfer_review),
]
