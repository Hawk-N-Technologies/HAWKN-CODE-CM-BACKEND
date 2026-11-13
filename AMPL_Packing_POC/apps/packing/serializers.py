"""Plain-dict builders for packing API responses."""
from apps.packing.models import Box, BoxItem, ConfigurationItem
from apps.packing.services.box_service import box_progress


def _user_name(user):
    if user is None:
        return None
    return user.get_full_name() or user.username


def config_payload(version):
    if version is None:
        return None
    items = (
        ConfigurationItem.objects.filter(version_id=version.pk)
        .select_related("sku")
        .order_by("sku__code")
    )
    return {
        "id": version.pk,
        "code": version.configuration.code,
        "version_no": version.version_no,
        "label": str(version),
        "items": [
            {"sku_code": item.sku.code, "sku_name": item.sku.name, "quantity": item.quantity}
            for item in items
        ],
    }


def box_detail(box: Box) -> dict:
    items = (
        BoxItem.objects.filter(box_id=box.pk)
        .select_related("product_uid__sku", "scanned_by")
        .order_by("-scanned_at", "-id")
    )
    return {
        "public_id": str(box.public_id),
        "box_uid": box.box_uid,
        "status": box.status,
        "section": {"id": box.section_id, "code": box.section.code, "name": box.section.name},
        "config": config_payload(box.config_version),
        "opened_by": _user_name(box.opened_by),
        "opened_at": box.opened_at,
        "completed_by": _user_name(box.completed_by),
        "completed_at": box.completed_at,
        "cancelled_at": box.cancelled_at,
        "cancel_reason": box.cancel_reason,
        "progress": box_progress(box),
        "items": [
            {
                "uid": item.product_uid.uid,
                "sku_code": item.product_uid.sku.code,
                "scanned_at": item.scanned_at,
                "scanned_by": _user_name(item.scanned_by),
            }
            for item in items
        ],
    }


def section_payload(section, open_box=None) -> dict:
    progress = box_progress(open_box) if open_box else None
    return {
        "id": section.pk,
        "code": section.code,
        "name": section.name,
        "active_config": config_payload(section.active_config_version),
        "open_box": {
            "public_id": str(open_box.public_id),
            "opened_at": open_box.opened_at,
            "total_scanned": progress["total_scanned"],
            "total_expected": progress["total_expected"],
        }
        if open_box
        else None,
    }
