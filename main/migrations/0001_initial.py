from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="DateRange",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
            ],
            options={
                "ordering": ["start_date", "end_date"],
                "verbose_name": "Date",
                "verbose_name_plural": "Dates",
            },
        ),
        migrations.CreateModel(
            name="Venue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField()),
                ("facilities", models.JSONField(blank=True, default=list)),
                ("price", models.PositiveIntegerField()),
                ("location", models.CharField(max_length=255)),
                ("image", models.ImageField(blank=True, upload_to="venues/")),
            ],
            options={
                "ordering": ["title"],
            },
        ),
        migrations.CreateModel(
            name="Booking",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username", models.CharField(max_length=255)),
                ("has_been_paid", models.BooleanField(default=False)),
                ("notes", models.TextField(blank=True)),
                (
                    "date",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="booking",
                        to="main.daterange",
                    ),
                ),
                (
                    "venue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bookings",
                        to="main.venue",
                    ),
                ),
            ],
            options={
                "ordering": ["-date__start_date", "username"],
            },
        ),
    ]
