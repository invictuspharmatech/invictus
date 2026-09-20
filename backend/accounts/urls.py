from django.urls import path

from accounts import views

urlpatterns = [
    path("login/", views.login_view),
    path("register/", views.register_view),
    path("me/", views.me_view),
]
