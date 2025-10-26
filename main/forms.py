from __future__ import annotations

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import Booking, BookingDate, Comment, Venue

User = get_user_model()


def _split_facilities(value: str) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [item for item in value if item]
    facilities = [item.strip() for item in value.split(",")]
    return [item for item in facilities if item]


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
    type = forms.ChoiceField(
        choices=Venue.VenueType.choices,
        widget=forms.Select(),
    )
    facilities = forms.CharField(
        required=False,
        help_text="Separate facilities with commas",
        widget=forms.TextInput(
            attrs={
                "placeholder": "Wi-Fi, Parking, Catering",
            }
        ),
    )

    class Meta:
        model = Venue
        fields = [
            "title",
            "type",
            "description",
            "facilities",
            "price",
            "location",
            "image",
        ]

    def clean_facilities(self) -> list[str]:
        return _split_facilities(self.cleaned_data.get("facilities", ""))


class BookingForm(forms.ModelForm):
    username = forms.CharField(
        max_length=150,
        label="Guest username",
        widget=forms.TextInput(
            attrs={
                "autocomplete": "off",
                "placeholder": "Search by username",
            }
        ),
    )
    start_date = forms.DateField(input_formats=["%Y-%m-%d"])
    end_date = forms.DateField(input_formats=["%Y-%m-%d"])

    class Meta:
        model = Booking
        fields = ["user", "venue", "has_been_paid", "notes"]
        widgets = {
            "user": forms.HiddenInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["user"].required = False
        if self.instance and self.instance.pk:
            self.fields["username"].initial = self.instance.user.get_username()

    def clean(self) -> dict[str, object]:
        cleaned = super().clean()
        start = cleaned.get("start_date")
        end = cleaned.get("end_date")
        if start and end and end < start:
            raise ValidationError("End date cannot be before the start date.")

        if not User.objects.exists():
            raise ValidationError("Create a user account before adding bookings.")

        user_obj = cleaned.get("user")
        if user_obj:
            cleaned["user"] = user_obj
            return cleaned

        username = (cleaned.get("username") or "").strip()
        if not username:
            self.add_error("username", "Please choose a username from the list.")
            return cleaned

        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email__iexact=username)
            except User.DoesNotExist:
                self.add_error(
                    "username",
                    "The specified username does not exist. Please select an existing user.",
                )
                return cleaned

        cleaned["user"] = user
        return cleaned

    def save(self, commit: bool = True) -> Booking:
        booking = super().save(commit=False)
        start = self.cleaned_data["start_date"]
        end = self.cleaned_data["end_date"]

        if booking.pk and booking.date_id:
            booking_date = booking.date
            booking_date.start_date = start
            booking_date.end_date = end
        else:
            booking_date = BookingDate(start_date=start, end_date=end)

        if commit:
            booking_date.save()
            booking.date = booking_date
            booking.save()
        else:
            booking.date = booking_date

        return booking


class CommentForm(forms.ModelForm):
    rating = forms.ChoiceField(
        choices=[(str(value), str(value)) for value in range(1, 6)],
        widget=forms.Select(),
    )
    comment = forms.CharField(
        widget=forms.Textarea(
            attrs={
                "rows": 4,
                "placeholder": "Share your experience with this venue…",
            }
        )
    )

    class Meta:
        model = Comment
        fields = ["rating", "comment"]

    def clean_rating(self) -> int:
        rating = self.cleaned_data.get("rating")
        try:
            rating_value = int(rating)
        except (TypeError, ValueError):
            raise forms.ValidationError("Choose a rating between 1 and 5.")
        if rating_value < 1 or rating_value > 5:
            raise forms.ValidationError("Choose a rating between 1 and 5.")
        return rating_value


class PublicBookingForm(forms.Form):
    start_date = forms.DateField(
        input_formats=["%Y-%m-%d"],
        widget=forms.DateInput(attrs={"type": "date"}),
    )
    end_date = forms.DateField(
        input_formats=["%Y-%m-%d"],
        widget=forms.DateInput(attrs={"type": "date"}),
    )
    notes = forms.CharField(
        required=False,
        widget=forms.Textarea(
            attrs={
                "rows": 3,
                "placeholder": "Add anything the venue manager should know…",
            }
        ),
    )

    def clean(self) -> dict[str, object]:
        cleaned_data = super().clean()
        start = cleaned_data.get("start_date")
        end = cleaned_data.get("end_date")
        if start and end and end < start:
            raise forms.ValidationError("End date cannot be before the start date.")
        return cleaned_data
