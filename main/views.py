from __future__ import annotations

import re

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required

from django.core.paginator import Paginator
from django.db.models import Avg, Case, CharField, Count, Q, Sum, Value, When
from django.db.models.functions import Cast, Coalesce, Concat
from django.http import (
    HttpRequest,
    HttpResponse,
    HttpResponseForbidden,
    JsonResponse,
)
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.html import json_script
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .forms import (
    BookingForm,
    CommentForm,
    PublicBookingForm,
    SignupForm,
    VenueForm,
)
from .models import Booking, BookingDate, Comment, CommentVenue, Venue
from .sample_data import ensure_sample_data


DEFAULT_PAGE_SIZE = 6
MAX_PAGE_SIZE = 50


def login_page(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("main:dashboard")
    return render(request, "main/login.html")


def register_page(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("main:dashboard")
    return render(request, "main/register.html")


def _is_ajax(request: HttpRequest) -> bool:
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
    if _user_is_staff(request.user):
        return redirect("main:admin_panel")

    ensure_sample_data()

    today = timezone.localdate()
    venues_queryset = _base_venue_queryset().annotate(
        total_bookings=Count("bookings", distinct=True)
    )
    top_venues = list(
        venues_queryset.order_by("-total_bookings", "-average_rating", "title")[:3]
    )

    total_venues = venues_queryset.count()
    total_bookings = Booking.objects.count()
    paid_bookings = Booking.objects.filter(has_been_paid=True).count()
    upcoming_bookings = (
        Booking.objects.filter(date__start_date__gte=today).count()
    )
    unique_players = (
        Booking.objects.exclude(user=None).values("user_id").distinct().count()
    )
    overall_rating = Venue.objects.aggregate(
        average=Avg("comments__rating")
    )["average"]

    metrics = {
        "total_venues": total_venues,
        "total_bookings": total_bookings,
        "paid_bookings": paid_bookings,
        "upcoming_bookings": upcoming_bookings,
        "unique_players": unique_players,
        "overall_rating": overall_rating,
    }

    context = {
        "metrics": metrics,
        "top_venues": top_venues,
    }

    template = (
        "main/partials/landing_fragment.html"
        if _is_ajax(request)
        else "main/landing.html"
    )
    return render(request, template, context)


def _user_is_staff(user) -> bool:
    return user.is_staff or user.is_superuser


def _forbid_if_not_staff(request: HttpRequest) -> HttpResponse | None:
    if not _user_is_staff(request.user):
        return HttpResponseForbidden("You do not have permission to access this page.")
    return None


def _serialize_venue(venue: Venue) -> dict[str, object]:
    average_rating_attr = getattr(venue, "average_rating", None)
    average_rating = (
        float(average_rating_attr) if average_rating_attr is not None else None
    )
    rating_count_attr = getattr(venue, "rating_count", None)
    rating_count = (
        int(rating_count_attr)
        if rating_count_attr is not None
        else venue.comments.count()
    )
    if average_rating is None:
        average = venue.comments.aggregate(avg=Avg("rating"))["avg"]
        average_rating = float(average) if average is not None else None
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
        "average_rating": average_rating,
        "rating_count": int(rating_count),
    }


def _base_venue_queryset():
    return Venue.objects.annotate(
        average_rating=Avg("comments__rating"),
        rating_count=Count("comments", distinct=True),
    )


def _normalize_facilities(raw_facilities) -> list[str]:
    facility_list: list[str] = []

    if isinstance(raw_facilities, (list, tuple, set)):
        for item in raw_facilities:
            text = str(item).strip()
            if text:
                facility_list.append(text)
    elif isinstance(raw_facilities, str):
        segments = re.split(r"[,\n]+", raw_facilities.replace("\r", "\n"))
        for segment in segments:
            text = segment.strip()
            if text:
                facility_list.append(text)
    elif raw_facilities:
        segments = re.split(r"[,\n]+", str(raw_facilities).replace("\r", "\n"))
        for segment in segments:
            text = segment.strip()
            if text:
                facility_list.append(text)

    return facility_list


def _serialize_comment(
    comment: Comment, *, request_user=None
) -> dict[str, object]:
    user_payload = _serialize_user(comment.user)
    is_owner = bool(request_user and comment.user_id == request_user.id)
    can_moderate = bool(request_user and _user_is_staff(request_user))
    return {
        "id": comment.id,
        "rating": int(comment.rating),
        "comment": comment.comment,
        "date": comment.date.isoformat(),
        "user": user_payload,
        "can_edit": is_owner,
        "can_delete": is_owner or can_moderate,
    }


def _comment_stats_for_venue(venue: Venue) -> dict[str, object]:
    aggregate = venue.comments.aggregate(
        average=Avg("rating"),
        count=Count("id", distinct=True),
    )
    average_value = aggregate.get("average")
    return {
        "average_rating": float(average_value) if average_value is not None else None,
        "count": int(aggregate.get("count") or 0),
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
            "price": booking.venue.price,
            "location": booking.venue.location,
        },
        "has_been_paid": booking.has_been_paid,
        "date_paid": booking.date_paid.isoformat() if booking.date_paid else None,
        "start_date": booking.date.start_date.isoformat(),
        "end_date": booking.date.end_date.isoformat(),
        "notes": booking.notes,
        "created_at": booking.created_at.isoformat(),
        "updated_at": booking.updated_at.isoformat(),
    }


def _build_booking_analytics() -> dict[str, dict[str, list]]:
    paid_bookings = Booking.objects.filter(has_been_paid=True, date_paid__isnull=False)

    sales_queryset = (
        paid_bookings.values("date_paid")
        .annotate(total_sales=Sum("venue__price"))
        .order_by("date_paid")
    )
    sales_labels: list[str] = []
    sales_totals: list[int] = []
    for item in sales_queryset:
        date_value = item.get("date_paid")
        if date_value is None:
            continue
        sales_labels.append(date_value.isoformat())
        sales_totals.append(int(item.get("total_sales") or 0))

    popularity_queryset = (
        paid_bookings.values("venue__title")
        .annotate(total_bookings=Count("id"))
        .order_by("venue__title")
    )
    popularity_labels: list[str] = []
    popularity_totals: list[int] = []
    for item in popularity_queryset:
        title = item.get("venue__title") or "Unknown venue"
        popularity_labels.append(title)
        popularity_totals.append(int(item.get("total_bookings") or 0))

    return {
        "sales": {"labels": sales_labels, "data": sales_totals},
        "popularity": {"labels": popularity_labels, "data": popularity_totals},
    }


@login_required
def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("main:login")


def _parse_positive_int(value: str | None, default: int, *, max_value: int | None = None) -> int:
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        return default
    if parsed < 1:
        return default
    if max_value is not None and parsed > max_value:
        return max_value
    return parsed


def _apply_venue_search(queryset, query: str):
    if not query:
        return queryset
    trimmed = query.strip()
    if not trimmed:
        return queryset
    queryset = queryset.annotate(price_text=Cast("price", output_field=CharField()))
    filters = (
        Q(title__icontains=trimmed)
        | Q(type__icontains=trimmed)
        | Q(location__icontains=trimmed)
        | Q(description__icontains=trimmed)
        | Q(facilities__icontains=trimmed)
        | Q(price_text__icontains=trimmed)
    )
    return queryset.filter(filters)


def _apply_booking_search(queryset, query: str):
    if not query:
        return queryset
    trimmed = query.strip()
    if not trimmed:
        return queryset

    queryset = queryset.annotate(
        start_date_text=Cast("date__start_date", output_field=CharField()),
        end_date_text=Cast("date__end_date", output_field=CharField()),
        user_full_name=Concat(
            Coalesce("user__first_name", Value("")),
            Value(" "),
            Coalesce("user__last_name", Value("")),
        ),
        paid_text=Case(
            When(has_been_paid=True, then=Value("paid")),
            default=Value("pending"),
            output_field=CharField(),
        ),
    )

    filters = (
        Q(user__username__icontains=trimmed)
        | Q(user_full_name__icontains=trimmed)
        | Q(venue__title__icontains=trimmed)
        | Q(notes__icontains=trimmed)
        | Q(start_date_text__icontains=trimmed)
        | Q(end_date_text__icontains=trimmed)
        | Q(paid_text__icontains=trimmed)
    )
    return queryset.filter(filters)


def _build_paginated_payload(
    queryset,
    *,
    page: int,
    page_size: int,
    serializer,
    query: str,
    extra_meta: dict[str, object] | None = None,
):
    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page)

    data = [serializer(item) for item in page_obj.object_list]
    meta: dict[str, object] = {
        "page": page_obj.number,
        "page_size": page_obj.paginator.per_page,
        "total_pages": page_obj.paginator.num_pages,
        "total_items": page_obj.paginator.count,
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
        "query": query.strip(),
    }
    if extra_meta:
        meta.update(extra_meta)
    return data, meta


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

    ensure_sample_data()

    User = get_user_model()
    page_size = DEFAULT_PAGE_SIZE
    venues_queryset = _base_venue_queryset()
    venues_total = Venue.objects.count()
    bookings_queryset = Booking.objects.select_related("venue", "date", "user")
    analytics = _build_booking_analytics()

    venues_data, venues_meta = _build_paginated_payload(
        venues_queryset,
        page=1,
        page_size=page_size,
        serializer=_serialize_venue,
        query="",
        extra_meta={"total_available": venues_total},
    )
    bookings_data, bookings_meta = _build_paginated_payload(
        bookings_queryset,
        page=1,
        page_size=page_size,
        serializer=_serialize_booking,
        query="",
        extra_meta={"has_users": User.objects.exists(), "analytics": analytics},
    )
    context = {
        "venues": {"data": venues_data, "meta": venues_meta},
        "bookings": {"data": bookings_data, "meta": bookings_meta},
        "has_users": bookings_meta["has_users"],
        "analytics": analytics,
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

    query = request.GET.get("q", "")
    page = _parse_positive_int(request.GET.get("page"), 1)
    page_size = _parse_positive_int(
        request.GET.get("page_size"),
        DEFAULT_PAGE_SIZE,
        max_value=MAX_PAGE_SIZE,
    )

    total_available = Venue.objects.count()
    venues_queryset = _base_venue_queryset()
    venues_queryset = _apply_venue_search(venues_queryset, query)
    data, meta = _build_paginated_payload(
        venues_queryset,
        page=page,
        page_size=page_size,
        serializer=_serialize_venue,
        query=query,
        extra_meta={"total_available": total_available},
    )
    return JsonResponse({"success": True, "data": data, "meta": meta})


@login_required
def venues_page(request: HttpRequest) -> HttpResponse:
    ensure_sample_data()

    venues_queryset = _base_venue_queryset().order_by("title")
    venues = [_serialize_venue(venue) for venue in venues_queryset]
    for venue in venues:
        facility_list = _normalize_facilities(venue.get("facilities"))

        facility_terms = " ".join(facility_list)

        pieces = [
            venue.get("title"),
            venue.get("type"),
            venue.get("location"),
            venue.get("description"),
            facility_terms,
        ]
        price = venue.get("price")
        if price is not None:
            pieces.append(str(price))
        rating = venue.get("average_rating")
        if rating is not None:
            pieces.append(f"{rating:.1f}")
        venue["search_blob"] = " ".join(
            str(piece).strip() for piece in pieces if piece
        ).lower()

        venue["facility_list"] = facility_list

    context = {"venues": venues}
    template = (
        "main/partials/venues_fragment.html"
        if _is_ajax(request)
        else "main/venues.html"
    )
    return render(request, template, context)


@login_required
def bookings_page(request: HttpRequest) -> HttpResponse:
    if _user_is_staff(request.user):
        return redirect("main:admin_panel")

    ensure_sample_data()

    bookings_queryset = (
        Booking.objects.select_related("venue", "date")
        .filter(user=request.user)
        .order_by("-date__start_date", "-created_at")
    )
    bookings = list(bookings_queryset)

    today = timezone.localdate()
    total_spend = 0
    upcoming_count = 0
    paid_count = 0

    for booking in bookings:
        start_date = booking.date.start_date
        end_date = booking.date.end_date
        duration_days = max((end_date - start_date).days + 1, 1)
        booking.duration_days = duration_days
        booking.duration_label = (
            "1 day" if duration_days == 1 else f"{duration_days} days"
        )
        booking.total_value = (booking.venue.price or 0) * duration_days
        booking.is_upcoming = start_date >= today
        booking.search_blob = " ".join(
            str(piece).strip()
            for piece in [
                booking.venue.title,
                booking.venue.location,
                booking.notes,
                start_date.isoformat(),
                end_date.isoformat(),
                "paid" if booking.has_been_paid else "pending",
            ]
            if piece
        ).lower()
        booking.status_label = (
            "Paid in full" if booking.has_been_paid else "Awaiting payment"
        )
        booking.status_key = "paid" if booking.has_been_paid else "pending"

        if booking.has_been_paid:
            paid_count += 1
            total_spend += booking.total_value
        if start_date >= today:
            upcoming_count += 1

    next_booking = None
    if bookings:
        upcoming_sorted = sorted(
            (b for b in bookings if b.date.start_date >= today),
            key=lambda item: (item.date.start_date, item.date.end_date),
        )
        next_booking = upcoming_sorted[0] if upcoming_sorted else None

    total_count = len(bookings)
    stats = {
        "total": total_count,
        "upcoming": upcoming_count,
        "paid": paid_count,
        "pending": total_count - paid_count,
        "lifetime_spend": total_spend,
    }

    context = {
        "bookings": bookings,
        "stats": stats,
        "next_booking": next_booking,
    }

    template = (
        "main/partials/bookings_fragment.html"
        if _is_ajax(request)
        else "main/bookings.html"
    )
    return render(request, template, context)


@login_required
@ensure_csrf_cookie
def venue_detail_page(request: HttpRequest, pk: int) -> HttpResponse:
    ensure_sample_data()

    venue_obj = get_object_or_404(_base_venue_queryset(), pk=pk)
    venue_data = _serialize_venue(venue_obj)
    venue_data["facility_list"] = _normalize_facilities(venue_data.get("facilities"))

    comments_queryset = (
        Comment.objects.filter(venue_links__venue=venue_obj)
        .select_related("user")
        .order_by("-date", "-id")
    )
    comments_payload = [
        _serialize_comment(comment, request_user=request.user)
        for comment in comments_queryset
    ]

    comment_update_template = reverse(
        "main:venue_comments_update_api",
        args=[venue_obj.id, 0],
    )
    comment_delete_template = reverse(
        "main:venue_comments_delete_api",
        args=[venue_obj.id, 0],
    )
    comments_script_id = f"venue-comments-{venue_obj.id}"
    comments_json_script = json_script(comments_payload, comments_script_id)

    context = {
        "venue": venue_data,
        "comments_payload": comments_payload,
        "comment_objects": comments_queryset,
        "comment_update_template": comment_update_template,
        "comment_delete_template": comment_delete_template,
        "comments_script_id": comments_script_id,
        "comments_json_script": comments_json_script,
    }

    template = (
        "main/partials/venue_detail_fragment.html"
        if _is_ajax(request)
        else "main/venue_detail.html"
    )
    return render(request, template, context)


@login_required
@require_POST
def venue_comments_create_api(request: HttpRequest, pk: int) -> JsonResponse:
    venue = get_object_or_404(Venue, pk=pk)
    form = CommentForm(request.POST)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    comment = form.save(commit=False)
    comment.user = request.user
    comment.save()
    CommentVenue.objects.create(comment=comment, venue=venue)

    serialized = _serialize_comment(comment, request_user=request.user)
    stats = _comment_stats_for_venue(venue)
    return JsonResponse({"success": True, "data": serialized, "meta": stats})


@login_required
@require_POST
def venue_comments_update_api(request: HttpRequest, pk: int, comment_pk: int) -> JsonResponse:
    venue = get_object_or_404(Venue, pk=pk)
    comment = get_object_or_404(
        Comment.objects.select_related("user").filter(venue_links__venue=venue),
        pk=comment_pk,
    )

    if comment.user_id != request.user.id and not _user_is_staff(request.user):
        return JsonResponse(
            {
                "success": False,
                "errors": ["You do not have permission to edit this comment."],
            },
            status=403,
        )

    form = CommentForm(request.POST, instance=comment)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    updated_comment = form.save()
    serialized = _serialize_comment(updated_comment, request_user=request.user)
    stats = _comment_stats_for_venue(venue)
    return JsonResponse({"success": True, "data": serialized, "meta": stats})


@login_required
@require_POST
def venue_comments_delete_api(request: HttpRequest, pk: int, comment_pk: int) -> JsonResponse:
    venue = get_object_or_404(Venue, pk=pk)
    comment = get_object_or_404(
        Comment.objects.select_related("user").filter(venue_links__venue=venue),
        pk=comment_pk,
    )

    if comment.user_id != request.user.id and not _user_is_staff(request.user):
        return JsonResponse(
            {
                "success": False,
                "errors": ["You do not have permission to delete this comment."],
            },
            status=403,
        )

    comment.delete()
    stats = _comment_stats_for_venue(venue)
    return JsonResponse({"success": True, "meta": stats})


@login_required
@require_POST
def venue_booking_create_api(request: HttpRequest, pk: int) -> JsonResponse:
    venue = get_object_or_404(Venue, pk=pk)
    form = PublicBookingForm(request.POST)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": _json_errors(form)}, status=400)

    booking_date = BookingDate.objects.create(
        start_date=form.cleaned_data["start_date"],
        end_date=form.cleaned_data["end_date"],
    )
    booking = Booking.objects.create(
        user=request.user,
        venue=venue,
        date=booking_date,
        notes=form.cleaned_data.get("notes") or "",
    )

    return JsonResponse({"success": True, "data": _serialize_booking(booking)})


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

    query = request.GET.get("q", "")
    page = _parse_positive_int(request.GET.get("page"), 1)
    page_size = _parse_positive_int(
        request.GET.get("page_size"),
        DEFAULT_PAGE_SIZE,
        max_value=MAX_PAGE_SIZE,
    )

    bookings_queryset = Booking.objects.select_related("venue", "date", "user")
    bookings_queryset = _apply_booking_search(bookings_queryset, query)
    User = get_user_model()
    analytics = _build_booking_analytics()
    data, meta = _build_paginated_payload(
        bookings_queryset,
        page=page,
        page_size=page_size,
        serializer=_serialize_booking,
        query=query,
        extra_meta={"has_users": User.objects.exists(), "analytics": analytics},
    )
    return JsonResponse({"success": True, "data": data, "meta": meta})


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
