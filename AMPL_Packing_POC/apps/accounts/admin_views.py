"""Admin API for AMPL user accounts (admins and operators)."""
import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.common.exceptions import AppError
from apps.common.responses import success_response

from .models import User
from .permissions import IsAmplAdmin

USERNAME_REGEX = r"^[A-Za-z0-9_.@+-]{3,150}$"


def user_admin_payload(user) -> dict:
    return {
        "id": user.pk,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": user.get_full_name() or user.username,
        "role": user.role,
        "is_active": user.is_active,
        "last_login": user.last_login,
        "created_at": user.date_joined,
        "sections": list(
            user.section_assignments.order_by("section__code").values_list("section__code", flat=True)
        ),
    }


def _check_password(password, user):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"password": list(exc.messages)}) from exc


def _apply_role(user, role):
    user.role = role
    user.is_staff = role == User.Role.ADMIN       # admins may open the Django admin console
    user.is_superuser = role == User.Role.ADMIN   # single admin role in the POC


class UserCreateInput(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    role = serializers.ChoiceField(choices=User.Role.choices)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        value = value.strip()
        if not re.fullmatch(USERNAME_REGEX, value):
            raise serializers.ValidationError("3+ characters: letters, digits and . _ - @ + only.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(f"Username {value} is already taken.")
        return value

    def validate(self, attrs):
        candidate = User(username=attrs["username"], first_name=attrs["first_name"], last_name=attrs["last_name"])
        _check_password(attrs["password"], candidate)
        return attrs


class UserUpdateInput(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)
    password = serializers.CharField(max_length=128, trim_whitespace=False, required=False)


class UserListView(APIView):
    """GET /users?role=OPERATOR   POST /users {username, password, role, first_name, last_name}"""

    permission_classes = [IsAmplAdmin]

    def get(self, request):
        users = User.objects.order_by("role", "username")
        role = request.query_params.get("role", "").strip().upper()
        if role in User.Role.values:
            users = users.filter(role=role)
        return success_response([user_admin_payload(user) for user in users])

    def post(self, request):
        data = UserCreateInput(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        user = User(
            username=values["username"],
            first_name=values["first_name"].strip(),
            last_name=values["last_name"].strip(),
            is_active=True,
        )
        _apply_role(user, values["role"])
        user.set_password(values["password"])
        user.save()
        return success_response(
            user_admin_payload(user), message=f"User {user.username} created.", status=status.HTTP_201_CREATED
        )


class UserDetailView(APIView):
    """PATCH /users/{id} {first_name, last_name, role, is_active, password}"""

    permission_classes = [IsAmplAdmin]

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        data = UserUpdateInput(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data

        if user.pk == request.user.pk and (
            values.get("is_active") is False or values.get("role", User.Role.ADMIN) != User.Role.ADMIN
        ):
            raise AppError(
                "CANNOT_CHANGE_SELF",
                "You cannot deactivate or demote your own account.",
                status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            for field in ("first_name", "last_name"):
                if field in values:
                    setattr(user, field, values[field].strip())
            if "role" in values:
                _apply_role(user, values["role"])
            if "is_active" in values:
                user.is_active = values["is_active"]
            if values.get("password"):
                _check_password(values["password"], user)
                user.set_password(values["password"])
            user.save()
        return success_response(user_admin_payload(user), message="User updated.")
