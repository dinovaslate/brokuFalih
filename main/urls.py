from django.urls import path

from . import views

app_name = "main"

urlpatterns = [
    path("", views.login_page, name="login"),
    path("register/", views.register_page, name="register"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("logout/", views.logout_view, name="logout"),
    path("api/login/", views.login_api, name="login_api"),
    path("api/register/", views.register_api, name="register_api"),
    path("dashboard/api/venues/", views.venues_collection, name="venues_collection"),
    path("dashboard/api/venues/<int:venue_id>/", views.venue_detail, name="venue_detail"),
    path("dashboard/api/bookings/", views.bookings_collection, name="bookings_collection"),
    path(
        "dashboard/api/bookings/<int:booking_id>/",
        views.booking_detail,
        name="booking_detail",
    ),
]
