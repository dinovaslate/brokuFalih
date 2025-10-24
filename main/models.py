from __future__ import annotations

from django.db import models


class DateRange(models.Model):
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        ordering = ["start_date", "end_date"]
        verbose_name = "Date"
        verbose_name_plural = "Dates"

    def __str__(self) -> str:
        return f"{self.start_date:%Y-%m-%d} → {self.end_date:%Y-%m-%d}"


class Venue(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    facilities = models.JSONField(default=list, blank=True)
    price = models.PositiveIntegerField()
    location = models.CharField(max_length=255)
    image = models.ImageField(upload_to="venues/", blank=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title


class Booking(models.Model):
    username = models.CharField(max_length=255)
    venue = models.ForeignKey(Venue, related_name="bookings", on_delete=models.CASCADE)
    has_been_paid = models.BooleanField(default=False)
    date = models.OneToOneField(DateRange, related_name="booking", on_delete=models.CASCADE)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date__start_date", "username"]

    def __str__(self) -> str:
        return f"{self.username} → {self.venue.title}"
