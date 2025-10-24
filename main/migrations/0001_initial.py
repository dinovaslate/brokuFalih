# Generated manually to define initial schema for venues and bookings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='BookingDate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
            ],
            options={
                'ordering': ['start_date', 'end_date'],
            },
        ),
        migrations.CreateModel(
            name='Venue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('facilities', models.JSONField(blank=True, default=list)),
                ('price', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(0)])),
                ('location', models.CharField(max_length=255)),
                ('image', models.ImageField(blank=True, upload_to='venues/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['title'],
            },
        ),
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=255)),
                ('has_been_paid', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('date', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='booking', to='main.bookingdate')),
                ('venue', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to='main.venue')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
