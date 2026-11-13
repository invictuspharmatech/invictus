from django.urls import path

from accounts import views

urlpatterns = [
    path("login/", views.login_view),
    path("register/", views.register_view),
    path("forgot-password/", views.forgot_password_view),
    path("reset-password/", views.reset_password_view),
    path("verify-email/", views.verify_email_view),
    path("resend-verification/", views.resend_verification_view),
    path("touch/", views.touch_view),
    path("me/", views.me_view),
    path("me/password/", views.change_password_view),
    path("launch-notify/", views.launch_notify_view),
]
