from django.contrib import admin

from .models import Booking, DateRange, Venue


@admin.register(DateRange)
class DateRangeAdmin(admin.ModelAdmin):
    list_display = ("start_date", "end_date")
    ordering = ("start_date",)


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ("title", "location", "price")
    search_fields = ("title", "location")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("username", "venue", "has_been_paid", "get_start_date", "get_end_date")
    list_filter = ("has_been_paid", "venue")
    search_fields = ("username", "venue__title")

    @admin.display(ordering="date__start_date", description="Start date")
    def get_start_date(self, obj):
        return obj.date.start_date if obj.date else None

    @admin.display(ordering="date__end_date", description="End date")
    def get_end_date(self, obj):
        return obj.date.end_date if obj.date else None
