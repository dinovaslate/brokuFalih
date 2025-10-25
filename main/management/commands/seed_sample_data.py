from __future__ import annotations

from datetime import datetime

from django.core.management.base import BaseCommand, CommandError

from ...sample_data import ensure_sample_data


class Command(BaseCommand):
    help = "Insert deterministic demo venues and bookings for analytics previews."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--base-date",
            dest="base_date",
            help="Optional YYYY-MM-DD date to anchor the generated bookings.",
        )

    def handle(self, *args, **options):
        base_date_option = options.get("base_date")
        base_date = None

        if base_date_option:
            try:
                base_date = datetime.strptime(base_date_option, "%Y-%m-%d").date()
            except ValueError as exc:
                raise CommandError(
                    "--base-date must be formatted as YYYY-MM-DD"
                ) from exc

        ensure_sample_data(base_date=base_date)
        self.stdout.write(self.style.SUCCESS("Seeded demo venues and bookings."))
