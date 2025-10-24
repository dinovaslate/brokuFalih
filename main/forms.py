from __future__ import annotations

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

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
