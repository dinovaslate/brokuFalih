from __future__ import annotations

from django.db import migrations


def seed_sample_data(apps, schema_editor) -> None:
    if schema_editor.connection.alias != "default":
        return

    from ..sample_data import ensure_sample_data

    ensure_sample_data()


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0005_booking_date_paid"),
    ]

    operations = [
        migrations.RunPython(seed_sample_data, migrations.RunPython.noop),
    ]
