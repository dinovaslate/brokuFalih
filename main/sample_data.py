from __future__ import annotations

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Booking, BookingDate, Comment, Venue

UserModel = get_user_model()


SAMPLE_USERS: list[dict[str, str]] = [
    {
        "username": "demo.alex",
        "first_name": "Alex",
        "last_name": "Rivera",
        "email": "alex.rivera@example.com",
        "password": "demo12345",
    },
    {
        "username": "demo.briana",
        "first_name": "Briana",
        "last_name": "Singh",
        "email": "briana.singh@example.com",
        "password": "demo12345",
    },
    {
        "username": "demo.chloe",
        "first_name": "Chloe",
        "last_name": "Mendez",
        "email": "chloe.mendez@example.com",
        "password": "demo12345",
    },
    {
        "username": "demo.darius",
        "first_name": "Darius",
        "last_name": "Ng",
        "email": "darius.ng@example.com",
        "password": "demo12345",
    },
]

SAMPLE_VENUES: list[dict[str, object]] = [
    {
        "title": "Aurora Sports Dome",
        "type": Venue.VenueType.FUTSAL,
        "description": "Indoor futsal pitch with climate control, lounge seating, and LED scoreboards.",
        "facilities": [
            "Locker rooms",
            "On-site cafe",
            "LED scoreboards",
        ],
        "price": 550000,
        "location": "Jakarta, Indonesia",
    },
    {
        "title": "Harborview Badminton Center",
        "type": Venue.VenueType.BADMINTON,
        "description": "Six international-standard courts with sprung flooring and pro shop services.",
        "facilities": [
            "Stringing service",
            "Equipment rental",
            "Private coaching rooms",
        ],
        "price": 320000,
        "location": "Surabaya, Indonesia",
    },
    {
        "title": "Summit Court Arena",
        "type": Venue.VenueType.BASKET,
        "description": "Full-sized basketball court with seating for 500 and premium locker facilities.",
        "facilities": [
            "Courtside seating",
            "Hydration station",
            "Strength studio",
        ],
        "price": 680000,
        "location": "Bandung, Indonesia",
    },
]

SAMPLE_COMMENTS: list[dict[str, object]] = [
    {
        "username": "demo.alex",
        "rating": 5,
        "comment": (
            "Climate control at Aurora Sports Dome keeps the futsal pitch "
            "comfortable, and the LED scoreboards make our league nights feel "
            "professional."
        ),
        "venues": ["Aurora Sports Dome"],
        "date_delta": 5,
    },
    {
        "username": "demo.darius",
        "rating": 4,
        "comment": (
            "The lounge seating at Aurora Sports Dome is perfect for teams "
            "between matches, and staff keep the locker rooms spotless."
        ),
        "venues": ["Aurora Sports Dome"],
        "date_delta": 8,
    },
    {
        "username": "demo.briana",
        "rating": 5,
        "comment": (
            "Harborview Badminton Center's sprung flooring feels great and the "
            "stringing service had my rackets tuned before play."
        ),
        "venues": ["Harborview Badminton Center"],
        "date_delta": 10,
    },
    {
        "username": "demo.chloe",
        "rating": 4,
        "comment": (
            "We rented equipment at Harborview Badminton Center and it was in "
            "excellent shape—private coaching rooms were a bonus."
        ),
        "venues": ["Harborview Badminton Center"],
        "date_delta": 13,
    },
    {
        "username": "demo.briana",
        "rating": 5,
        "comment": (
            "Summit Court Arena has bright sightlines, plenty of seating, and "
            "the hydration station kept our team fresh."
        ),
        "venues": ["Summit Court Arena"],
        "date_delta": 15,
    },
    {
        "username": "demo.alex",
        "rating": 4,
        "comment": (
            "Loved the strength studio at Summit Court Arena for a warm-up "
            "session before hitting the court."
        ),
        "venues": ["Summit Court Arena"],
        "date_delta": 18,
    },
]

SAMPLE_BOOKINGS: list[dict[str, object]] = [
    {
        "username": "demo.alex",
        "venue": "Aurora Sports Dome",
        "paid": True,
        "start_delta": 4,
        "duration": 1,
        "paid_delta": 2,
        "notes": "Corporate futsal league quarter-final.",
    },
    {
        "username": "demo.briana",
        "venue": "Harborview Badminton Center",
        "paid": True,
        "start_delta": 10,
        "duration": 1,
        "paid_delta": 7,
        "notes": "Doubles ladder tournament for regional club members.",
    },
    {
        "username": "demo.chloe",
        "venue": "Summit Court Arena",
        "paid": False,
        "start_delta": 15,
        "duration": 2,
        "paid_delta": None,
        "notes": "Weekend youth development camp (pending payment).",
    },
    {
        "username": "demo.alex",
        "venue": "Harborview Badminton Center",
        "paid": True,
        "start_delta": 1,
        "duration": 1,
        "paid_delta": 0,
        "notes": "Casual evening session with coaching support.",
    },
    {
        "username": "demo.darius",
        "venue": "Aurora Sports Dome",
        "paid": True,
        "start_delta": 13,
        "duration": 1,
        "paid_delta": 9,
        "notes": "Friendly futsal meetup celebrating a birthday.",
    },
    {
        "username": "demo.briana",
        "venue": "Summit Court Arena",
        "paid": True,
        "start_delta": 18,
        "duration": 1,
        "paid_delta": 16,
        "notes": "Three-on-three charity showcase for alumni.",
    },
]


def _get_or_create_users() -> dict[str, UserModel]:
    users: dict[str, UserModel] = {}
    for payload in SAMPLE_USERS:
        user, created = UserModel.objects.get_or_create(
            username=payload["username"],
            defaults={
                "first_name": payload["first_name"],
                "last_name": payload["last_name"],
                "email": payload["email"],
            },
        )
        if created:
            user.set_password(payload["password"])
            user.save(update_fields=["password"])
        elif not user.email:
            user.email = payload["email"]
            user.save(update_fields=["email"])
        users[user.username] = user
    return users


def _get_or_create_venues() -> dict[str, Venue]:
    venues: dict[str, Venue] = {}
    for payload in SAMPLE_VENUES:
        venue, _ = Venue.objects.get_or_create(
            title=payload["title"],
            defaults={
                "type": payload["type"],
                "description": payload["description"],
                "facilities": payload["facilities"],
                "price": payload["price"],
                "location": payload["location"],
            },
        )
        venues[venue.title] = venue
    for venue in Venue.objects.all():
        venues.setdefault(venue.title, venue)
    return venues


def _create_bookings(users: dict[str, UserModel], venues: dict[str, Venue], *, base_date):
    today = timezone.localdate()
    base_reference = base_date or today - timedelta(days=21)

    for payload in SAMPLE_BOOKINGS:
        username = payload["username"]
        venue_title = payload["venue"]
        user = users.get(username)
        venue = venues.get(venue_title)
        if user is None or venue is None:
            continue

        start_date = base_reference + timedelta(days=int(payload["start_delta"]))
        end_date = start_date + timedelta(days=int(payload["duration"]))

        if Booking.objects.filter(
            user=user,
            venue=venue,
            date__start_date=start_date,
        ).exists():
            continue

        booking_date = BookingDate.objects.create(
            start_date=start_date,
            end_date=end_date,
        )

        booking = Booking(
            user=user,
            venue=venue,
            has_been_paid=bool(payload["paid"]),
            date=booking_date,
            notes=str(payload["notes"]),
        )

        paid_delta = payload.get("paid_delta")
        if booking.has_been_paid and paid_delta is not None:
            date_paid = base_reference + timedelta(days=int(paid_delta))
            if date_paid > today:
                date_paid = today
            booking.date_paid = date_paid

        booking.save()


def _resolve_comment_date(*, base_reference, today, payload) -> date:
    date_delta = payload.get("date_delta")
    if date_delta is not None:
        candidate = base_reference + timedelta(days=int(date_delta))
        return candidate if candidate <= today else today

    days_ago = payload.get("days_ago")
    if days_ago is not None:
        return today - timedelta(days=int(days_ago))

    return today


def _create_comments(
    users: dict[str, UserModel], venues: dict[str, Venue], *, base_date
) -> None:
    if not users:
        return

    today = timezone.localdate()
    base_reference = base_date or today - timedelta(days=21)
    default_user = next(iter(users.values()), None)

    for payload in SAMPLE_COMMENTS:
        username = payload.get("username")
        user = users.get(username) or default_user
        if user is None:
            continue

        comment_text = str(payload.get("comment", "")).strip()
        if not comment_text:
            continue

        rating = int(payload.get("rating", 0))
        if rating < 1 or rating > 5:
            rating = max(1, min(5, rating))

        comment_date = _resolve_comment_date(
            base_reference=base_reference, today=today, payload=payload
        )

        comment, created = Comment.objects.get_or_create(
            user=user,
            comment=comment_text,
            defaults={"rating": rating, "date": comment_date},
        )

        if not created:
            updates: list[str] = []
            if comment.rating != rating:
                comment.rating = rating
                updates.append("rating")
            if comment.date != comment_date:
                comment.date = comment_date
                updates.append("date")
            if updates:
                comment.save(update_fields=updates)

        for title in payload.get("venues", []):
            venue = venues.get(title)
            if venue is not None:
                comment.venue.add(venue)

    for venue in Venue.objects.all():
        if venue.comments.exists() or default_user is None:
            continue

        generic_text = (
            f"Enjoyed playing at {venue.title}. Facilities were clean and the "
            "staff were welcoming."
        )
        comment, _ = Comment.objects.get_or_create(
            user=default_user,
            comment=generic_text,
            defaults={"rating": 4, "date": today},
        )
        comment.venue.add(venue)


def ensure_sample_data(*, base_date=None) -> None:
    """Populate the database with demo venues and bookings when empty.

    The admin panel graphs and tables look empty without any data. This helper
    seeds a small set of deterministic demo records so that new environments
    immediately showcase venue activity and booking analytics. Real data is
    left untouched: the fixtures only run when no bookings exist yet. The
    caller can override ``base_date`` for deterministic testing.
    """

    if Booking.objects.exists():
        return

    with transaction.atomic():
        venues = _get_or_create_venues()
        users = _get_or_create_users()
        _create_bookings(users, venues, base_date=base_date)
        _create_comments(users, venues, base_date=base_date)

        # Ensure we still have venues even if bookings were skipped for safety.
        if not Venue.objects.exists():
            for payload in SAMPLE_VENUES:
                Venue.objects.create(**payload)
