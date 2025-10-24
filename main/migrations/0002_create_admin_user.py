from __future__ import annotations

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


def create_admin_user(apps, schema_editor):
    model_label = settings.AUTH_USER_MODEL.split('.')
    User = apps.get_model(model_label[0], model_label[1])
    username = 'admin'
    if User.objects.filter(username=username).exists():
        return
    User.objects.create(
        username=username,
        email='admin@example.com',
        is_staff=True,
        is_superuser=True,
        is_active=True,
        password=make_password('admin123'),
    )


def remove_admin_user(apps, schema_editor):
    model_label = settings.AUTH_USER_MODEL.split('.')
    User = apps.get_model(model_label[0], model_label[1])
    User.objects.filter(username='admin').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(create_admin_user, remove_admin_user),
    ]
