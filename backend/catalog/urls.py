from django.urls import path

from catalog import views

urlpatterns = [
    path("categories/", views.category_list),
    path("products/", views.product_list),
    path("cart/stock-check/", views.cart_stock_check),
    path("products/<uuid:pk>/stock-notify/", views.product_stock_notify),
    path("products/<slug:slug>/", views.product_detail),
    path("test-results/", views.test_result_list),
    path("admin/products/", views.admin_product_list),
    path("admin/products/bulk/", views.admin_products_bulk),
    path("admin/products/export/", views.admin_products_export),
    path("admin/products/import/", views.admin_products_import),
    path("admin/products/import-images/", views.admin_products_import_images),
    path("admin/products/next-sku/", views.admin_products_next_sku),
    path("admin/products/generate-skus/", views.admin_products_generate_skus),
    path("admin/products/<uuid:pk>/", views.admin_product_detail),
    path("admin/products/<uuid:pk>/warehouse/", views.admin_product_warehouse),
    path("admin/categories/", views.admin_category_list),
    path("admin/categories/export/", views.admin_categories_export),
    path("admin/categories/import/", views.admin_categories_import),
    path("admin/categories/<uuid:pk>/", views.admin_category_detail),
    path("admin/stock-notifications/batches/", views.admin_stock_batches),
    path("admin/stock-notifications/batches/<uuid:pk>/", views.admin_stock_batch_action),
    path("admin/stock-notifications/subscriptions/", views.admin_stock_subscriptions),
    path("admin/test-results/", views.admin_test_results),
    path("admin/test-results/<uuid:pk>/", views.admin_test_result_detail),
    path("admin/stock-transfers/", views.admin_stock_transfers),
    path("admin/stock-transfers/<uuid:pk>/review/", views.admin_stock_transfer_review),
]
