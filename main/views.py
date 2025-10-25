from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import (
    HttpRequest,
    HttpResponse,
    HttpResponseForbidden,
    JsonResponse,
)
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .forms import BookingForm, SignupForm, VenueForm
from .models import Booking, Venue


def login_page(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("main:dashboard")
    return render(request, "main/login.html")


def register_page(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("main:dashboard")
    return render(request, "main/register.html")


@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
    return redirect("main:admin_panel")


def _user_is_staff(user) -> bool:
    return user.is_staff or user.is_superuser


def _forbid_if_not_staff(request: HttpRequest) -> HttpResponse | None:
    if not _user_is_staff(request.user):
        return HttpResponseForbidden("You do not have permission to access this page.")
    return None


def _serialize_venue(venue: Venue) -> dict[str, object]:
    return {
        "id": venue.id,
        "title": venue.title,
        "type": venue.type,
        "description": venue.description,
        "facilities": venue.facilities,
        "price": venue.price,
        "location": venue.location,
        "image_url": venue.image.url if venue.image else "",
        "created_at": venue.created_at.isoformat(),
        "updated_at": venue.updated_at.isoformat(),
}


def _serialize_user(user) -> dict[str, object] | None:
    if not user:
        return None
    full_name = user.get_full_name().strip()
    display_name = full_name or user.get_username()
    return {
        "id": user.id,
        "username": user.get_username(),
        "full_name": full_name,
        "email": user.email,
        "display_name": display_name,
    }


def _serialize_booking(booking: Booking) -> dict[str, object]:
    return {
        "id": booking.id,
        "username": booking.user.get_username() if booking.user else "",
        "user": _serialize_user(booking.user),
        "venue": {
            "id": booking.venue_id,
            "title": booking.venue.title,
        },
        "has_been_paid": booking.has_been_paid,
        "start_date": booking.date.start_date.isoformat(),
        "end_date": booking.date.end_date.isoformat(),
        "notes": booking.notes,
        "created_at": booking.created_at.isoformat(),
        "updated_at": booking.updated_at.isoformat(),
    }


@login_required
def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("main:login")


@require_POST
def login_api(request: HttpRequest) -> JsonResponse:
    identifier = request.POST.get("email", "").strip()
    password = request.POST.get("password", "")

    errors: list[str] = []
    if not identifier:
        errors.append("Please enter your email or username.")
    if not password:
        errors.append("Please enter your password.")

    user = None
    if not errors:
        User = get_user_model()
        candidate_username = identifier
        try:
            matched_user = User.objects.get(email__iexact=identifier)
            candidate_username = matched_user.get_username()
        except User.DoesNotExist:
            pass

        user = authenticate(request, username=candidate_username, password=password)
        if user is None:
            errors.append("Invalid login credentials.")

    if errors:
        return JsonResponse({"success": False, "errors": errors}, status=400)

    login(request, user)
    return JsonResponse({"success": True, "redirect_url": reverse("main:dashboard")})


@require_POST
def register_api(request: HttpRequest) -> JsonResponse:
    form = SignupForm(request.POST)
    if not form.is_valid():
        errors = [error for error_list in form.errors.values() for error in error_list]
        return JsonResponse({"success": False, "errors": errors}, status=400)

    user = form.save()
    login(request, user)
    return JsonResponse({"success": True, "redirect_url": reverse("main:dashboard")})


@login_required
@ensure_csrf_cookie
def admin_panel(request: HttpRequest) -> HttpResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    User = get_user_model()
    venues = [_serialize_venue(venue) for venue in Venue.objects.all()]
    bookings = [
        _serialize_booking(booking)
        for booking in Booking.objects.select_related("venue", "date", "user")
    ]
    context = {
        "venues": venues,
        "bookings": bookings,
        "has_users": User.objects.exists(),
    }
    return render(request, "main/admin_panel.html", context)


def _json_errors(form) -> list[str]:
    return [error for error_list in form.errors.values() for error in error_list]


@login_required
@require_GET
def venues_list_api(request: HttpRequest) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    venues = [_serialize_venue(venue) for venue in Venue.objects.all()]
    return JsonResponse({"success": True, "data": venues})


@login_required
@require_POST
def venues_create_api(request: HttpRequest) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    form = VenueForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    venue = form.save()
    return JsonResponse({"success": True, "data": _serialize_venue(venue)})


@login_required
@require_POST
def venues_update_api(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    venue = get_object_or_404(Venue, pk=pk)
    form = VenueForm(request.POST, request.FILES, instance=venue)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    venue = form.save()
    return JsonResponse({"success": True, "data": _serialize_venue(venue)})


@login_required
@require_POST
def venues_delete_api(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    venue = get_object_or_404(Venue, pk=pk)
    venue.delete()
    return JsonResponse({"success": True})


@login_required
@require_GET
def bookings_list_api(request: HttpRequest) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    bookings = [
        _serialize_booking(booking)
        for booking in Booking.objects.select_related("venue", "date", "user")
    ]
    User = get_user_model()
    return JsonResponse(
        {
            "success": True,
            "data": bookings,
            "meta": {"has_users": User.objects.exists()},
        }
    )


@login_required
@require_POST
def bookings_create_api(request: HttpRequest) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    form = BookingForm(request.POST)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    booking = form.save()
    return JsonResponse({"success": True, "data": _serialize_booking(booking)})


@login_required
@require_POST
def bookings_update_api(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    booking = get_object_or_404(Booking.objects.select_related("date"), pk=pk)
    form = BookingForm(request.POST, instance=booking)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    booking = form.save()
    return JsonResponse({"success": True, "data": _serialize_booking(booking)})


@login_required
@require_POST
def bookings_delete_api(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    booking = get_object_or_404(Booking, pk=pk)
    booking.date.delete()
    booking.delete()
    return JsonResponse({"success": True})


@login_required
@require_GET
def users_search_api(request: HttpRequest) -> JsonResponse:
    forbidden = _forbid_if_not_staff(request)
    if forbidden:
        return forbidden

    query = request.GET.get("q", "").strip()
    User = get_user_model()

    if not query:
        results = []
    else:
        results = [
            _serialize_user(user)
            for user in User.objects.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
            .order_by("username")[:10]
        ]

    return JsonResponse(
        {
            "success": True,
            "data": results,
            "meta": {"has_users": User.objects.exists()},
        }
    )
