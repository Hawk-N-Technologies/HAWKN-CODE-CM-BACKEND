"""
Create or update an AMPL user without hard-coding any credentials.

Examples:
    python manage.py create_ampl_user --username admin1 --role ADMIN
    python manage.py create_ampl_user --username operator1 --role OPERATOR --section A

Password: typed at the prompt (hidden), or taken from the environment
variable AMPL_USER_PASSWORD for scripted setups.
"""
import getpass
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

PASSWORD_ENV = "AMPL_USER_PASSWORD"


class Command(BaseCommand):
    help = "Create (or update with --update) an AMPL admin or operator account."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--role", required=True, choices=["ADMIN", "OPERATOR"])
        parser.add_argument("--first-name", default="")
        parser.add_argument("--last-name", default="")
        parser.add_argument(
            "--section",
            help="Packing section code to assign (operators only), e.g. A",
        )
        parser.add_argument(
            "--update", action="store_true",
            help="Update the password/role if the user already exists.",
        )

    def _read_password(self, user):
        password = os.environ.get(PASSWORD_ENV)
        if password:
            source = PASSWORD_ENV
        else:
            source = "prompt"
            password = getpass.getpass("Password: ")
            if password != getpass.getpass("Password (again): "):
                raise CommandError("Passwords do not match.")
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise CommandError(f"Password rejected ({source}): " + " ".join(exc.messages))
        return password

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        username = options["username"].strip()
        role = options["role"]

        user = User.objects.filter(username=username).first()
        if user and not options["update"]:
            raise CommandError(f"User '{username}' already exists. Use --update to change it.")

        creating = user is None
        if creating:
            user = User(username=username)

        user.role = role
        user.is_active = True
        user.is_staff = role == "ADMIN"  # admins may use the Django admin site
        if options["first_name"]:
            user.first_name = options["first_name"]
        if options["last_name"]:
            user.last_name = options["last_name"]

        user.set_password(self._read_password(user))
        user.save()

        if role == "ADMIN" and not user.is_superuser:
            user.is_superuser = True  # single admin role in the POC: full access
            user.save(update_fields=["is_superuser"])

        if options.get("section"):
            if role != "OPERATOR":
                raise CommandError("--section is only for operators.")
            from apps.packing.models import PackingSection, SectionOperator

            code = options["section"].strip().upper()
            section = PackingSection.objects.filter(code=code).first()
            if section is None:
                raise CommandError(f"Packing section '{code}' does not exist. Create it first.")
            SectionOperator.objects.get_or_create(section=section, user=user)

        verb = "Created" if creating else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} {role.lower()} '{username}'."))
