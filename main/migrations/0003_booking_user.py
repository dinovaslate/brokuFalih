from django.conf import settings
from django.db import migrations, models


def migrate_username_to_user(apps, schema_editor):
    Booking = apps.get_model('main', 'Booking')
    app_label, model_name = settings.AUTH_USER_MODEL.split('.')
    UserModel = apps.get_model(app_label, model_name)

    for booking in Booking.objects.all():
        username = getattr(booking, 'username', '') or ''
        username = username.strip()
        if not username:
            continue
        user = (
            UserModel.objects.filter(username__iexact=username).first()
            or UserModel.objects.filter(email__iexact=username).first()
        )
        if user:
            booking.user_id = user.pk
            booking.save(update_fields=['user'])


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0002_create_admin_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='user',
            field=models.ForeignKey(
                null=True,
                on_delete=models.CASCADE,
                related_name='bookings',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(migrate_username_to_user, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='booking',
            name='username',
        ),
    ]
