from django.urls import path

from accounts import views as account_views
from orders import btcpay_views, views

urlpatterns = [
    path("checkout/", views.checkout_view),
    path("contact/", views.contact_view),
    path("affiliate/apply/", account_views.affiliate_apply_view),
    path("account/orders/", views.account_orders_view),
    path("account/affiliate/", views.account_affiliate_view),
    path("account/summary/", views.account_summary_view),
    path("btc/webhook/", btcpay_views.btc_webhook_view),
    path("orders/pay/", btcpay_views.pay_token_info_view),
    path("orders/pay/invoice/", btcpay_views.pay_token_invoice_view),
    path("btc/invoice/<uuid:pk>/", btcpay_views.create_order_invoice_view),
    path("btc/order/<uuid:pk>/invoice/", btcpay_views.order_invoice_view),
    path("btc/invoice/status/<str:invoice_id>/", btcpay_views.invoice_status_view),
    path("admin/btcpay/", btcpay_views.admin_btcpay_settings_view),
    path("admin/btcpay/test/", btcpay_views.admin_btcpay_test_view),
    path("admin/btcpay/webhook/", btcpay_views.admin_btcpay_webhook_view),
    path("admin/overview/", views.admin_overview_view),
    path("admin/orders/", views.admin_orders_view),
    path("admin/orders/<uuid:pk>/status/", views.admin_order_status_view),
    path("admin/orders/<uuid:pk>/move-item/", views.admin_order_move_item),
    path("admin/fulfillment-requests/", views.admin_fulfillment_requests),
    path("admin/fulfillment-requests/<uuid:pk>/review/", views.admin_fulfillment_request_review),
    path("admin/accounting/", views.admin_accounting_view),
    path("admin/accounting/reset/", views.admin_accounting_reset_view),
    path("admin/users/", account_views.admin_users_view),
    path("admin/affiliates/", account_views.admin_affiliates_view),
    path("admin/affiliates/<uuid:pk>/", account_views.admin_affiliate_action_view),
]
