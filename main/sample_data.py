from __future__ import annotations

from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Booking, BookingDate, Venue

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
        "title": "Marvel Irawan Futbol Dome",
        "type": Venue.VenueType.SEPAK_BOLA,
        "description": "Premium sepak bola complex with FIFA-grade turf, tunnel lighting, and hospitality suites.",
        "facilities": [
            "Match-ready sepak bola equipment",
            "Professional locker rooms",
            "VIP hospitality lounge",
        ],
        "price": 1500000,
        "location": "Emerald Garden, Jakarta",
    },
    {
        "title": "Star Wars Themed Venue",
        "type": Venue.VenueType.TENNIS,
        "description": "Immersive tennis experience with cinematic lighting, themed music, and holographic scoreboards.",
        "facilities": [
            "Holographic scoreboard",
            "Cantina-inspired lunchroom",
            "Themed locker pods",
        ],
        "price": 2500000,
        "location": "Emerald Garden, Jakarta",
    },
    {
        "title": "Harborview Badminton Center",
        "type": Venue.VenueType.BADMINTON,
        "description": "Six international-standard courts with sprung flooring, pro shop services, and streaming booths.",
        "facilities": [
            "Stringing service",
            "Equipment rental",
            "Private coaching rooms",
        ],
        "price": 980000,
        "location": "Surabaya, Indonesia",
    },
]

SAMPLE_BOOKINGS: list[dict[str, object]] = [
    {
        "username": "demo.alex",
        "venue": "Marvel Irawan Futbol Dome",
        "paid": True,
        "start_delta": 2,
        "duration": 1,
        "paid_delta": 1,
        "notes": "Corporate futsal league quarter-final with hospitality add-ons.",
    },
    {
        "username": "demo.briana",
        "venue": "Star Wars Themed Venue",
        "paid": True,
        "start_delta": 5,
        "duration": 1,
        "paid_delta": 4,
        "notes": "Lightsaber doubles tournament for premium members.",
    },
    {
        "username": "demo.chloe",
        "venue": "Marvel Irawan Futbol Dome",
        "paid": False,
        "start_delta": 9,
        "duration": 1,
        "paid_delta": None,
        "notes": "Junior academy friendly awaiting payment confirmation.",
    },
    {
        "username": "demo.darius",
        "venue": "Harborview Badminton Center",
        "paid": True,
        "start_delta": 12,
        "duration": 1,
        "paid_delta": 10,
        "notes": "Regional club doubles ladder finals.",
    },
    {
        "username": "demo.alex",
        "venue": "Star Wars Themed Venue",
        "paid": True,
        "start_delta": 14,
        "duration": 2,
        "paid_delta": 13,
        "notes": "Weekend immersive tennis bootcamp.",
    },
    {
        "username": "demo.briana",
        "venue": "Harborview Badminton Center",
        "paid": True,
        "start_delta": 17,
        "duration": 1,
        "paid_delta": 16,
        "notes": "Charity ladder showcase with live streaming booth.",
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
        fields_to_update: list[str] = []
        if user.first_name != payload["first_name"]:
            user.first_name = payload["first_name"]
            fields_to_update.append("first_name")
        if user.last_name != payload["last_name"]:
            user.last_name = payload["last_name"]
            fields_to_update.append("last_name")
        if user.email != payload["email"]:
            user.email = payload["email"]
            fields_to_update.append("email")
        if created:
            user.set_password(payload["password"])
            fields_to_update.append("password")
        if fields_to_update:
            user.save(update_fields=fields_to_update)
        users[user.username] = user
    return users


def _get_or_create_venues() -> dict[str, Venue]:
    venues: dict[str, Venue] = {}
    for payload in SAMPLE_VENUES:
        venue, created = Venue.objects.get_or_create(
            title=payload["title"],
            defaults={
                "type": payload["type"],
                "description": payload["description"],
                "facilities": payload["facilities"],
                "price": payload["price"],
                "location": payload["location"],
            },
        )
        fields_to_update: list[str] = []
        for field_name in ("type", "description", "facilities", "price", "location"):
            if getattr(venue, field_name) != payload[field_name]:
                setattr(venue, field_name, payload[field_name])
                fields_to_update.append(field_name)
        if fields_to_update and not created:
            venue.save(update_fields=fields_to_update)
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

        booking = (
            Booking.objects.select_related("date")
            .filter(
                user=user,
                venue=venue,
                date__start_date=start_date,
            )
            .first()
        )

        paid_delta = payload.get("paid_delta")
        desired_paid = bool(payload["paid"])
        desired_date_paid = None
        if desired_paid and paid_delta is not None:
            desired_date_paid = base_reference + timedelta(days=int(paid_delta))
            if desired_date_paid > today:
                desired_date_paid = today

        if booking:
            fields_to_update: list[str] = []
            if booking.date.start_date != start_date or booking.date.end_date != end_date:
                booking.date.start_date = start_date
                booking.date.end_date = end_date
                booking.date.save(update_fields=["start_date", "end_date"])
            if booking.has_been_paid != desired_paid:
                booking.has_been_paid = desired_paid
                fields_to_update.append("has_been_paid")
            if booking.date_paid != desired_date_paid:
                booking.date_paid = desired_date_paid
                fields_to_update.append("date_paid")
            if booking.notes != payload["notes"]:
                booking.notes = str(payload["notes"])
                fields_to_update.append("notes")
            if fields_to_update:
                booking.save(update_fields=fields_to_update)
            continue

        booking_date = BookingDate.objects.create(
            start_date=start_date,
            end_date=end_date,
        )

        booking = Booking(
            user=user,
            venue=venue,
            has_been_paid=desired_paid,
            date=booking_date,
            notes=str(payload["notes"]),
            date_paid=desired_date_paid,
        )
        booking.save()


def ensure_sample_data(*, base_date=None) -> None:
    """Populate the database with demo venues and bookings.

    The admin panel graphs and tables look empty without any data. This helper
    seeds a small set of deterministic demo records so that new environments
    immediately showcase venue activity and booking analytics. The operation is
    idempotent: calling it repeatedly refreshes the demo records without
    duplicating them. The caller can override ``base_date`` for deterministic
    testing.
    """

    with transaction.atomic():
        venues = _get_or_create_venues()
        users = _get_or_create_users()
        _create_bookings(users, venues, base_date=base_date)

        # Ensure we still have venues even if bookings were skipped for safety.
        if not Venue.objects.exists():
            for payload in SAMPLE_VENUES:
                Venue.objects.create(**payload)
