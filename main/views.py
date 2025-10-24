from __future__ import annotations

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST, require_http_methods

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
    if not request.user.is_staff:
        return HttpResponseForbidden("You do not have permission to access this page.")

    venue_detail_url = reverse("main:venue_detail", args=[0])
    booking_detail_url = reverse("main:booking_detail", args=[0])
    venue_detail_base = venue_detail_url.rstrip("/")
    venue_detail_base = venue_detail_base.rsplit("/", 1)[0] + "/"
    booking_detail_base = booking_detail_url.rstrip("/")
    booking_detail_base = booking_detail_base.rsplit("/", 1)[0] + "/"
    context = {
        "venues_url": reverse("main:venues_collection"),
        "venue_detail_base": venue_detail_base,
        "bookings_url": reverse("main:bookings_collection"),
        "booking_detail_base": booking_detail_base,
    }
    return render(request, "main/dashboard.html", context)


@login_required
def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("main:login")


def _form_errors(form: VenueForm | BookingForm) -> list[str]:
    return [error for error_list in form.errors.values() for error in error_list]


def _serialize_venue(venue: Venue, request: HttpRequest) -> dict[str, object]:
    image_url = venue.image.url if venue.image else ""
    if image_url:
        image_url = request.build_absolute_uri(image_url)
    return {
        "id": venue.pk,
        "title": venue.title,
        "description": venue.description,
        "facilities": venue.facilities or [],
        "price": venue.price,
        "location": venue.location,
        "image_url": image_url,
    }


def _serialize_booking(booking: Booking, request: HttpRequest) -> dict[str, object]:
    date = booking.date
    return {
        "id": booking.pk,
        "username": booking.username,
        "venue_id": booking.venue_id,
        "venue_title": booking.venue.title,
        "has_been_paid": booking.has_been_paid,
        "notes": booking.notes,
        "date": {
            "start": date.start_date.isoformat() if date else None,
            "end": date.end_date.isoformat() if date else None,
        },
    }


def _ensure_staff(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_staff:
        return JsonResponse(
            {
                "success": False,
                "errors": ["You do not have permission to perform this action."],
            },
            status=403,
        )
    return None


@require_POST
def login_api(request: HttpRequest) -> JsonResponse:
    email = request.POST.get("email", "").strip().lower()
    password = request.POST.get("password", "")

    errors: list[str] = []
    if not email:
        errors.append("Please enter your email address.")
    if not password:
        errors.append("Please enter your password.")

    user = None
    if not errors:
        user = authenticate(request, username=email, password=password)
        if user is None:
            errors.append("Invalid email or password.")

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
@require_http_methods(["GET", "POST"])
def venues_collection(request: HttpRequest) -> JsonResponse:
    permission_response = _ensure_staff(request)
    if permission_response:
        return permission_response

    if request.method == "GET":
        venues = Venue.objects.all()
        data = [_serialize_venue(venue, request) for venue in venues]
        return JsonResponse({"success": True, "data": data})

    form = VenueForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _form_errors(form)}, status=400)

    venue = form.save()
    return JsonResponse({"success": True, "data": _serialize_venue(venue, request)}, status=201)


@login_required
@require_http_methods(["GET", "POST"])
def venue_detail(request: HttpRequest, venue_id: int) -> JsonResponse:
    permission_response = _ensure_staff(request)
    if permission_response:
        return permission_response

    venue = get_object_or_404(Venue, pk=venue_id)

    if request.method == "GET":
        return JsonResponse({"success": True, "data": _serialize_venue(venue, request)})

    method = request.POST.get("_method", "").upper()
    if method == "DELETE":
        venue.delete()
        return JsonResponse({"success": True})
    if method in {"PUT", "PATCH"}:
        form = VenueForm(request.POST, request.FILES, instance=venue)
        if not form.is_valid():
            return JsonResponse({"success": False, "errors": _form_errors(form)}, status=400)
        venue = form.save()
        return JsonResponse({"success": True, "data": _serialize_venue(venue, request)})

    return JsonResponse(
        {"success": False, "errors": ["Unsupported operation."]},
        status=405,
    )


@login_required
@require_http_methods(["GET", "POST"])
def bookings_collection(request: HttpRequest) -> JsonResponse:
    permission_response = _ensure_staff(request)
    if permission_response:
        return permission_response

    if request.method == "GET":
        bookings = Booking.objects.select_related("venue", "date").all()
        data = [_serialize_booking(booking, request) for booking in bookings]
        return JsonResponse({"success": True, "data": data})

    form = BookingForm(request.POST)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _form_errors(form)}, status=400)

    booking = form.save()
    return JsonResponse({"success": True, "data": _serialize_booking(booking, request)}, status=201)


@login_required
@require_http_methods(["GET", "POST"])
def booking_detail(request: HttpRequest, booking_id: int) -> JsonResponse:
    permission_response = _ensure_staff(request)
    if permission_response:
        return permission_response

    booking = get_object_or_404(Booking.objects.select_related("venue", "date"), pk=booking_id)

    if request.method == "GET":
        return JsonResponse({"success": True, "data": _serialize_booking(booking, request)})

    method = request.POST.get("_method", "").upper()
    if method == "DELETE":
        date = booking.date
        booking.delete()
        if date:
            date.delete()
        return JsonResponse({"success": True})
    if method in {"PUT", "PATCH"}:
        form = BookingForm(request.POST, instance=booking)
        if not form.is_valid():
            return JsonResponse({"success": False, "errors": _form_errors(form)}, status=400)
        booking = form.save()
        booking.refresh_from_db()
        return JsonResponse({"success": True, "data": _serialize_booking(booking, request)})

    return JsonResponse(
        {"success": False, "errors": ["Unsupported operation."]},
        status=405,
    )
