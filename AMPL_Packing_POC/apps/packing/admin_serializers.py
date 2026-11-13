"""Input validation and output payloads for the admin screens."""
import re

from django.db.models import Count
from rest_framework import serializers

from apps.catalog.models import CODE_REGEX, Sku, normalize_code

from .models import Box, BoxConfiguration, BoxConfigurationVersion, PackingSection
from .serializers import _user_name, config_payload


def validate_code_value(value, model, label, instance=None):
    code = normalize_code(value)
    if not code:
        raise serializers.ValidationError("Code is required.")
    if not re.fullmatch(CODE_REGEX, code):
        raise serializers.ValidationError("Use letters, digits, '-' or '_' only, starting with a letter or digit.")
    duplicate = model.objects.filter(code=code)
    if instance is not None:
        duplicate = duplicate.exclude(pk=instance.pk)
    if duplicate.exists():
        raise serializers.ValidationError(f"{label} {code} already exists.")
    return code


def validate_name_value(value):
    value = value.strip()
    if not value:
        raise serializers.ValidationError("Name is required.")
    return value


class ItemInput(serializers.Serializer):
    sku_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=10000)


def validate_items_value(items):
    if not items:
        raise serializers.ValidationError("Add at least one SKU.")
    ids = [item["sku_id"] for item in items]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError("Each SKU can appear only once.")
    found = set(Sku.objects.filter(pk__in=ids, is_active=True).values_list("pk", flat=True))
    if any(sku_id not in found for sku_id in ids):
        raise serializers.ValidationError("An unknown or inactive SKU was selected.")
    return items


class ConfigCreateInput(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    name = serializers.CharField(max_length=200)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    items = ItemInput(many=True, allow_empty=True)

    def validate_code(self, value):
        return validate_code_value(value, BoxConfiguration, "Configuration")

    def validate_name(self, value):
        return validate_name_value(value)

    def validate_items(self, value):
        return validate_items_value(value)


class ConfigUpdateInput(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_name(self, value):
        return validate_name_value(value)


class VersionCreateInput(serializers.Serializer):
    items = ItemInput(many=True, allow_empty=True)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    apply_to_sections = serializers.BooleanField(required=False, default=True)

    def validate_items(self, value):
        return validate_items_value(value)


class SectionCreateInput(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    name = serializers.CharField(max_length=200)
    active_config_version_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_code(self, value):
        return validate_code_value(value, PackingSection, "Section")

    def validate_name(self, value):
        return validate_name_value(value)


class SectionUpdateInput(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    is_active = serializers.BooleanField(required=False)
    active_config_version_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_name(self, value):
        return validate_name_value(value)


class OperatorAssignInput(serializers.Serializer):
    user_id = serializers.IntegerField()


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
def _version_items(version):
    return [
        {"sku_id": item.sku_id, "sku_code": item.sku.code, "sku_name": item.sku.name, "quantity": item.quantity}
        for item in version.items.select_related("sku").order_by("sku__code")
    ]


def configuration_admin_payload(config: BoxConfiguration) -> dict:
    versions = list(
        BoxConfigurationVersion.objects.filter(configuration=config)
        .select_related("configuration", "created_by")
        .annotate(box_count=Count("boxes"))
        .order_by("-version_no")
    )
    used_by = list(
        PackingSection.objects.filter(active_config_version__configuration=config)
        .order_by("code")
        .values_list("code", flat=True)
    )
    return {
        "id": config.pk,
        "code": config.code,
        "name": config.name,
        "is_active": config.is_active,
        "created_at": config.created_at,
        "used_by_sections": used_by,
        "versions": [
            {
                **config_payload(version),
                "notes": version.notes,
                "created_at": version.created_at,
                "created_by": _user_name(version.created_by),
                "box_count": version.box_count,
                "items": _version_items(version),
                "total_quantity": sum(item.quantity for item in version.items.all()),
            }
            for version in versions
        ],
    }


def section_admin_payload(section: PackingSection) -> dict:
    open_box = Box.objects.filter(section=section, status=Box.Status.OPEN).first()
    operators = (
        section.operator_assignments.select_related("user").order_by("user__username")
    )
    version = section.active_config_version
    return {
        "id": section.pk,
        "code": section.code,
        "name": section.name,
        "is_active": section.is_active,
        "active_config_version_id": version.pk if version else None,
        "active_config": config_payload(version) if version else None,
        "has_open_box": open_box is not None,
        "operators": [
            {
                "id": assignment.user_id,
                "username": assignment.user.username,
                "display_name": _user_name(assignment.user),
                "is_active": assignment.user.is_active,
            }
            for assignment in operators
        ],
    }
