"""
Admin rules for box configurations and packing sections.

- A configuration version is never edited: "editing" creates a new version,
  so every packed box keeps the exact version it was packed with.
- New versions are applied to the sections using that configuration
  (unless told not to). A box that is already open keeps its own version.
"""
from django.db import transaction
from django.db.models import Max
from rest_framework import status

from apps.common.exceptions import AppError
from apps.packing.models import (
    Box,
    BoxConfiguration,
    BoxConfigurationVersion,
    ConfigurationItem,
    PackingSection,
)

HTTP_409 = status.HTTP_409_CONFLICT
HTTP_422 = status.HTTP_422_UNPROCESSABLE_ENTITY


def _add_items(version, items):
    ConfigurationItem.objects.bulk_create(
        [ConfigurationItem(version=version, sku_id=item["sku_id"], quantity=item["quantity"]) for item in items]
    )


def create_configuration(*, code, name, items, notes, user):
    with transaction.atomic():
        config = BoxConfiguration.objects.create(code=code, name=name, created_by=user)
        version = BoxConfigurationVersion.objects.create(
            configuration=config, version_no=1, notes=notes or "", created_by=user
        )
        _add_items(version, items)
    return config


def create_version(*, config, items, notes, user, apply_to_sections=True):
    """Returns (new_version, number_of_sections_switched_to_it)."""
    with transaction.atomic():
        locked = BoxConfiguration.objects.select_for_update().get(pk=config.pk)
        if not locked.is_active:
            raise AppError("CONFIG_INACTIVE", "Activate this configuration before changing it.", HTTP_409)
        latest = locked.versions.order_by("-version_no").first()
        if latest is not None:
            current = set(latest.items.values_list("sku_id", "quantity"))
            wanted = {(item["sku_id"], item["quantity"]) for item in items}
            if current == wanted:
                raise AppError("NO_CHANGES", "These SKUs and quantities are the same as the latest version.", HTTP_422)
        next_no = (locked.versions.aggregate(top=Max("version_no"))["top"] or 0) + 1
        version = BoxConfigurationVersion.objects.create(
            configuration=locked, version_no=next_no, notes=notes or "", created_by=user
        )
        _add_items(version, items)
        switched = 0
        if apply_to_sections:
            switched = PackingSection.objects.filter(
                active_config_version__configuration=locked
            ).update(active_config_version=version)
    return version, switched


def set_configuration_active(*, config, is_active):
    if not is_active and PackingSection.objects.filter(
        is_active=True, active_config_version__configuration=config
    ).exists():
        raise AppError(
            "CONFIG_IN_USE",
            "A packing section still uses this configuration. Assign another one first.",
            HTTP_409,
        )
    config.is_active = is_active
    config.save(update_fields=["is_active", "updated_at"])


def resolve_version_for_section(version_id):
    """Validate a configuration version chosen for a section (None = no configuration)."""
    if version_id is None:
        return None
    version = (
        BoxConfigurationVersion.objects.select_related("configuration")
        .filter(pk=version_id)
        .first()
    )
    if version is None or not version.configuration.is_active:
        raise AppError("INVALID_CONFIGURATION", "Choose an active box configuration.", HTTP_422)
    if not version.items.exists():
        raise AppError("INVALID_CONFIGURATION", "That configuration has no SKUs.", HTTP_422)
    return version


def set_section_active(*, section, is_active):
    if not is_active and Box.objects.filter(section=section, status=Box.Status.OPEN).exists():
        raise AppError(
            "SECTION_HAS_OPEN_BOX",
            "This section has an open box. Complete or cancel it first.",
            HTTP_409,
        )
    section.is_active = is_active
