from __future__ import annotations

from django.core.validators import MinValueValidator
from django.db import models


class BookingDate(models.Model):
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        ordering = ["start_date", "end_date"]

    def __str__(self) -> str:  # pragma: no cover - human readable only
        return f"{self.start_date:%Y-%m-%d} → {self.end_date:%Y-%m-%d}"


class Venue(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    facilities = models.JSONField(default=list, blank=True)
    price = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    location = models.CharField(max_length=255)
    image = models.ImageField(upload_to="venues/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:  # pragma: no cover - human readable only
        return self.title


class Booking(models.Model):
    username = models.CharField(max_length=255)
    venue = models.ForeignKey(Venue, related_name="bookings", on_delete=models.CASCADE)
    has_been_paid = models.BooleanField(default=False)
    date = models.OneToOneField(BookingDate, related_name="booking", on_delete=models.CASCADE)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - human readable only
        return f"Booking for {self.username}"
