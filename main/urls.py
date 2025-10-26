from django.urls import path

from . import views

app_name = "main"

urlpatterns = [
    path("", views.login_page, name="login"),
    path("register/", views.register_page, name="register"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("dashboard/venues/", views.venues_page, name="venues_page"),
    path("dashboard/bookings/", views.bookings_page, name="bookings_page"),
    path("dashboard/venues/<int:pk>/", views.venue_detail_page, name="venue_detail"),
    path("admin-panel/", views.admin_panel, name="admin_panel"),
    path("logout/", views.logout_view, name="logout"),
    path("api/login/", views.login_api, name="login_api"),
    path("api/register/", views.register_api, name="register_api"),
    path("api/venues/", views.venues_list_api, name="venues_list_api"),
    path("api/venues/create/", views.venues_create_api, name="venues_create_api"),
    path("api/venues/<int:pk>/update/", views.venues_update_api, name="venues_update_api"),
    path("api/venues/<int:pk>/delete/", views.venues_delete_api, name="venues_delete_api"),
    path(
        "api/venues/<int:pk>/comments/create/",
        views.venue_comments_create_api,
        name="venue_comments_create_api",
    ),
    path(
        "api/venues/<int:pk>/comments/<int:comment_pk>/update/",
        views.venue_comments_update_api,
        name="venue_comments_update_api",
    ),
    path(
        "api/venues/<int:pk>/comments/<int:comment_pk>/delete/",
        views.venue_comments_delete_api,
        name="venue_comments_delete_api",
    ),
    path(
        "api/venues/<int:pk>/bookings/create/",
        views.venue_booking_create_api,
        name="venue_booking_create_api",
    ),
    path("api/bookings/", views.bookings_list_api, name="bookings_list_api"),
    path("api/bookings/create/", views.bookings_create_api, name="bookings_create_api"),
    path("api/bookings/<int:pk>/update/", views.bookings_update_api, name="bookings_update_api"),
    path("api/bookings/<int:pk>/delete/", views.bookings_delete_api, name="bookings_delete_api"),
    path("api/users/search/", views.users_search_api, name="users_search_api"),
]
