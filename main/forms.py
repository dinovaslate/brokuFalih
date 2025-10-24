from __future__ import annotations

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import Booking, DateRange, Venue

User = get_user_model()


class SignupForm(forms.Form):
    full_name = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            "placeholder": "Your name",
            "autocomplete": "name",
        }),
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "placeholder": "Email address",
            "autocomplete": "email",
        })
    )
    password1 = forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "placeholder": "Password",
                "autocomplete": "new-password",
            }
        ),
    )
    password2 = forms.CharField(
        label="Confirm password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "placeholder": "Confirm password",
                "autocomplete": "new-password",
            }
        ),
    )

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email

    def clean_password1(self) -> str:
        password = self.cleaned_data.get("password1")
        if password:
            validate_password(password)
        return password

    def clean(self) -> dict[str, object]:
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise ValidationError("Passwords do not match.")
        return cleaned_data

    def save(self) -> User:
        full_name: str = self.cleaned_data["full_name"].strip()
        email: str = self.cleaned_data["email"].lower()
        password: str = self.cleaned_data["password1"]

        first_name = full_name
        last_name = ""
        if " " in full_name:
            first_name, last_name = full_name.split(" ", 1)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        return user


class VenueForm(forms.ModelForm):
    facilities = forms.CharField(required=False)

    class Meta:
        model = Venue
        fields = ["title", "description", "facilities", "price", "location", "image"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields["image"].required = False
            if isinstance(self.instance.facilities, list):
                self.initial.setdefault("facilities", ", ".join(self.instance.facilities))
        else:
            self.fields["image"].required = True

    def clean_facilities(self) -> list[str]:
        facilities = self.cleaned_data.get("facilities")
        if not facilities:
            return []
        if isinstance(facilities, list):
            return facilities
        if isinstance(facilities, str):
            parsed = [item.strip() for item in facilities.split(",") if item.strip()]
            return parsed
        raise ValidationError("Invalid facilities format.")


class BookingForm(forms.ModelForm):
    start_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    end_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))

    class Meta:
        model = Booking
        fields = ["username", "venue", "has_been_paid", "notes"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["notes"].required = False
        if self.instance and self.instance.pk and self.instance.date:
            self.initial.setdefault("start_date", self.instance.date.start_date)
            self.initial.setdefault("end_date", self.instance.date.end_date)

    def clean(self) -> dict[str, object]:
        cleaned_data = super().clean()
        start_date = cleaned_data.get("start_date")
        end_date = cleaned_data.get("end_date")
        if start_date and end_date and end_date < start_date:
            raise ValidationError("End date cannot be earlier than the start date.")
        return cleaned_data

    def save(self, commit: bool = True) -> Booking:
        booking = super().save(commit=False)
        start_date = self.cleaned_data["start_date"]
        end_date = self.cleaned_data["end_date"]

        if booking.pk and booking.date:
            date_range = booking.date
            date_range.start_date = start_date
            date_range.end_date = end_date
            if commit:
                date_range.save()
        else:
            date_range = DateRange(start_date=start_date, end_date=end_date)
            if commit:
                date_range.save()
        booking.date = date_range

        if commit:
            booking.save()
            self.save_m2m()
        return booking
