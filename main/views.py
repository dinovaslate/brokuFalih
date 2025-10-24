from __future__ import annotations

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from .forms import SignupForm


def login_page(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("main:dashboard")
    return render(request, "main/login.html")


def register_page(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("main:dashboard")
    return render(request, "main/register.html")


@login_required
def dashboard(request: HttpRequest) -> HttpResponse:
    return render(request, "main/dashboard.html")


@login_required
def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("main:login")


@require_POST
def login_api(request: HttpRequest) -> JsonResponse:
    email = request.POST.get("email", "").strip().lower()
    password = request.POST.get("password", "")

    errors: list[str] = []
    if not email:
        errors.append("Please enter your email address.")
    if not password:
        errors.append("Please enter your password.")

    user = None
    if not errors:
        user = authenticate(request, username=email, password=password)
        if user is None:
            errors.append("Invalid email or password.")

    if errors:
        return JsonResponse({"success": False, "errors": errors}, status=400)

    login(request, user)
    return JsonResponse({"success": True, "redirect_url": reverse("main:dashboard")})


@require_POST
def register_api(request: HttpRequest) -> JsonResponse:
    form = SignupForm(request.POST)
    if not form.is_valid():
        errors = [error for error_list in form.errors.values() for error in error_list]
        return JsonResponse({"success": False, "errors": errors}, status=400)

    user = form.save()
    login(request, user)
    return JsonResponse({"success": True, "redirect_url": reverse("main:dashboard")})
