from __future__ import annotations

from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db import connection, transaction
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

SAMPLE_REVIEWS: list[dict[str, object]] = [
    {
        "username": "demo.alex",
        "rating": 5,
        "comment": "{title} exceeded our expectations with spotless facilities and attentive staff.",
    },
    {
        "username": "demo.briana",
        "rating": 4,
        "comment": "Loved the atmosphere at {title}; we'll definitely book again soon!",
    },
    {
        "username": "demo.chloe",
        "rating": 5,
        "comment": "Training sessions at {title} ran smoothly thanks to the well-kept courts.",
    },
    {
        "username": "demo.darius",
        "rating": 4,
        "comment": "Great experience at {title}—excellent amenities and easy check-in process.",
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


def _seed_fake_reviews(users: dict[str, UserModel]) -> None:
    """Populate venues with deterministic review data when missing."""

    tables = set(connection.introspection.table_names())
    comment_table = Comment._meta.db_table
    through_table = Comment.venue.through._meta.db_table
    if comment_table not in tables or through_table not in tables:
        return

    available_users = list(users.values())
    if not available_users:
        available_users = list(UserModel.objects.all())
    if not available_users:
        return

    today = timezone.localdate()

    for venue_index, venue in enumerate(Venue.objects.all().order_by("id")):
        if venue.comments.exists():
            continue

        for offset, template in enumerate(SAMPLE_REVIEWS):
            user = users.get(template.get("username"))
            if user is None:
                user = available_users[(venue_index + offset) % len(available_users)]

            comment = Comment.objects.create(
                user=user,
                rating=int(template.get("rating", 5)),
                comment=template["comment"].format(title=venue.title),
                date=today - timedelta(days=(venue_index + offset) % 7),
            )
            comment.venue.add(venue)


def ensure_sample_data(*, base_date=None) -> None:
    """Populate the database with demo venues, bookings, and reviews.

    The admin panel graphs and tables look empty without any data. This helper
    seeds a small set of deterministic demo records so that new environments
    immediately showcase venue activity, rating visuals, and booking analytics.
    Real data is preserved: bookings are only generated when none exist yet,
    while venue reviews are added solely for venues lacking feedback. The
    caller can override ``base_date`` for deterministic testing.
    """

    with transaction.atomic():
        venues = _get_or_create_venues()
        users = _get_or_create_users()

        if not Booking.objects.exists():
            _create_bookings(users, venues, base_date=base_date)

        _seed_fake_reviews(users)

        _seed_fake_reviews(users)

        # Ensure we still have venues even if bookings were skipped for safety.
        if not Venue.objects.exists():
            for payload in SAMPLE_VENUES:
                Venue.objects.create(**payload)
