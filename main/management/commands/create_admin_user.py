from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create or update an admin user with the supplied credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            required=True,
            help="Email address for the admin account.",
        )
        parser.add_argument(
            "--password",
            required=True,
            help="Password for the admin account.",
        )
        parser.add_argument(
            "--username",
            default="admin",
            help="Username for the admin account (default: admin).",
        )

    def handle(self, *args, **options):
        email = options["email"].strip()
        password = options["password"]
        username = options["username"].strip()

        if not email:
            raise CommandError("The --email option cannot be empty.")
        if not password:
            raise CommandError("The --password option cannot be empty.")
        if not username:
            raise CommandError("The --username option cannot be empty.")

        User = get_user_model()

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        if not created:
            user.email = email
            user.is_staff = True
            user.is_superuser = True

        user.set_password(password)
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(
                f"Admin user '{username}' created successfully."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Admin user '{username}' updated successfully."
            ))
