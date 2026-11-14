"""Admin API: box configurations, packing sections and operator assignments."""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView

from apps.accounts.permissions import IsAmplAdmin
from apps.common.exceptions import AppError
from apps.common.responses import success_response

from .admin_serializers import (
    ConfigCreateInput,
    ConfigUpdateInput,
    OperatorAssignInput,
    SectionCreateInput,
    SectionUpdateInput,
    VersionCreateInput,
    configuration_admin_payload,
    section_admin_payload,
)
from .models import BoxConfiguration, PackingSection, SectionOperator
from .services.admin_service import (
    create_configuration,
    create_version,
    resolve_version_for_section,
    set_configuration_active,
    set_section_active,
)

SECTION_RELATED = ("active_config_version", "active_config_version__configuration")


def _section(pk):
    return get_object_or_404(PackingSection.objects.select_related(*SECTION_RELATED), pk=pk)


# ---------------------------------------------------------------------------
# Box configurations
# ---------------------------------------------------------------------------
class ConfigurationListView(APIView):
    """GET /box-configurations   POST /box-configurations {code, name, items, notes}"""

    permission_classes = [IsAmplAdmin]

    def get(self, request):
        configs = BoxConfiguration.objects.order_by("-is_active", "code")
        return success_response([configuration_admin_payload(config) for config in configs])

    def post(self, request):
        data = ConfigCreateInput(data=request.data)
        data.is_valid(raise_exception=True)
        config = create_configuration(user=request.user, **data.validated_data)
        return success_response(
            configuration_admin_payload(config),
            message=f"Configuration {config.code} created (version 1).",
            status=status.HTTP_201_CREATED,
        )


class ConfigurationDetailView(APIView):
    """GET / PATCH /box-configurations/{id} {name, is_active}"""

    permission_classes = [IsAmplAdmin]

    def get(self, request, pk):
        return success_response(configuration_admin_payload(get_object_or_404(BoxConfiguration, pk=pk)))

    def patch(self, request, pk):
        config = get_object_or_404(BoxConfiguration, pk=pk)
        data = ConfigUpdateInput(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        with transaction.atomic():
            if "name" in values:
                config.name = values["name"]
                config.save(update_fields=["name", "updated_at"])
            if "is_active" in values and values["is_active"] != config.is_active:
                set_configuration_active(config=config, is_active=values["is_active"])
        return success_response(configuration_admin_payload(config), message="Configuration updated.")


class ConfigurationVersionView(APIView):
    """POST /box-configurations/{id}/versions {items, notes, apply_to_sections}"""

    permission_classes = [IsAmplAdmin]

    def post(self, request, pk):
        config = get_object_or_404(BoxConfiguration, pk=pk)
        data = VersionCreateInput(data=request.data)
        data.is_valid(raise_exception=True)
        version, switched = create_version(config=config, user=request.user, **data.validated_data)
        message = f"Version {version.version_no} created."
        if switched:
            message += f" {switched} section(s) now use it."
        payload = configuration_admin_payload(config)
        payload["sections_switched"] = switched
        return success_response(payload, message=message, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Packing sections
# ---------------------------------------------------------------------------
class SectionListView(APIView):
    """GET /sections   POST /sections {code, name, active_config_version_id}"""

    permission_classes = [IsAmplAdmin]

    def get(self, request):
        sections = PackingSection.objects.select_related(*SECTION_RELATED).order_by("-is_active", "code")
        return success_response([section_admin_payload(section) for section in sections])

    def post(self, request):
        data = SectionCreateInput(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        version = resolve_version_for_section(values.get("active_config_version_id"))
        section = PackingSection.objects.create(
            code=values["code"], name=values["name"], active_config_version=version
        )
        return success_response(
            section_admin_payload(_section(section.pk)),
            message=f"Section {section.code} created.",
            status=status.HTTP_201_CREATED,
        )


class SectionDetailView(APIView):
    """PATCH /sections/{id} {name, is_active, active_config_version_id}"""

    permission_classes = [IsAmplAdmin]

    def patch(self, request, pk):
        section = _section(pk)
        data = SectionUpdateInput(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        with transaction.atomic():
            if "name" in values:
                section.name = values["name"]
            if "active_config_version_id" in values:
                # A box that is already open keeps its own version.
                section.active_config_version = resolve_version_for_section(values["active_config_version_id"])
            if "is_active" in values and values["is_active"] != section.is_active:
                set_section_active(section=section, is_active=values["is_active"])
            section.save()
        return success_response(section_admin_payload(_section(pk)), message="Section updated.")


class SectionOperatorsView(APIView):
    """POST /sections/{id}/operators {user_id}"""

    permission_classes = [IsAmplAdmin]

    def post(self, request, pk):
        section = _section(pk)
        data = OperatorAssignInput(data=request.data)
        data.is_valid(raise_exception=True)
        user = get_user_model().objects.filter(pk=data.validated_data["user_id"]).first()
        if user is None or not user.is_ampl_operator:
            raise AppError(
                "NOT_AN_OPERATOR",
                "Choose an active operator account.",
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        _, created = SectionOperator.objects.get_or_create(
            section=section, user=user, defaults={"assigned_by": request.user}
        )
        return success_response(
            section_admin_payload(_section(pk)),
            message=f"{user.username} assigned to {section.code}." if created else "Already assigned.",
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SectionOperatorDetailView(APIView):
    """DELETE /sections/{id}/operators/{user_id}"""

    permission_classes = [IsAmplAdmin]

    def delete(self, request, pk, user_id):
        section = _section(pk)
        deleted, _ = SectionOperator.objects.filter(section=section, user_id=user_id).delete()
        if not deleted:
            raise AppError("NOT_ASSIGNED", "That operator is not assigned here.", status.HTTP_404_NOT_FOUND)
        return success_response(section_admin_payload(_section(pk)), message="Operator removed.")
