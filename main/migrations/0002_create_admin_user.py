from django.contrib.auth.hashers import make_password
from django.db import migrations


ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'admin123'
ADMIN_EMAIL = 'admin@example.com'


def create_admin_user(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    if User.objects.filter(username=ADMIN_USERNAME).exists():
        return
    User.objects.create(
        username=ADMIN_USERNAME,
        email=ADMIN_EMAIL,
        is_staff=True,
        is_superuser=True,
        password=make_password(ADMIN_PASSWORD),
    )


def delete_admin_user(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    User.objects.filter(username=ADMIN_USERNAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_admin_user, delete_admin_user),
    ]
