"""
Scan box / item: read-only details for any scanned or typed label.

    product UID (e.g. 483921) -> its SKU, packed or not, and which box
    box ID (e.g. BOX-000001)  -> the box and every item inside it
"""
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status

from apps.catalog.models import ProductUid
from apps.common.exceptions import AppError
from apps.packing.models import Box
from apps.packing.serializers import box_detail
from apps.packing.services.box_service import user_can_pack
from apps.packing.services.scan_parser import BOX, PRODUCT, parse_scan

DONE_STATUSES = (Box.Status.COMPLETED, Box.Status.VERIFIED)
BOX_RELATED = (
    "section", "config_version", "config_version__configuration",
    "opened_by", "completed_by",
)


def _item_payload(product) -> dict:
    try:
        box = product.box_item.box
    except ObjectDoesNotExist:
        box = None
    return {
        "uid": product.uid,
        "sku_code": product.sku.code,
        "sku_name": product.sku.name,
        "status": product.status,
        "packed": product.status == ProductUid.Status.PACKED,
        "packed_at": product.packed_at,
        "box": {
            "public_id": str(box.public_id),
            "box_uid": box.box_uid,
            "section_code": box.section.code,
        }
        if box
        else None,
    }


def _box_payload(box, user) -> dict:
    data = box_detail(box)
    if box.status == Box.Status.VERIFIED:  # older boxes; verification is no longer used
        data["status"] = Box.Status.COMPLETED
    data["can_print"] = box.status in DONE_STATUSES and user_can_pack(user, box.section)
    return data


def lookup_code(*, raw_value, user) -> dict:
    """Returns {"kind": "ITEM", "item": {...}} or {"kind": "BOX", "box": {...}}."""
    parsed = parse_scan(raw_value)
    if parsed.kind == PRODUCT:
        product = (
            ProductUid.objects.select_related("sku", "box_item__box__section")
            .filter(uid=parsed.value)
            .first()
        )
        if product is None:
            raise AppError("UID_NOT_FOUND", f"Unknown product UID {parsed.value}.", status.HTTP_404_NOT_FOUND)
        return {"kind": "ITEM", "item": _item_payload(product)}
    if parsed.kind == BOX:
        box = Box.objects.select_related(*BOX_RELATED).filter(box_uid=parsed.value).first()
        if box is None:
            raise AppError("BOX_NOT_FOUND", f"Box {parsed.value} is not in the system.", status.HTTP_404_NOT_FOUND)
        return {"kind": "BOX", "box": _box_payload(box, user)}
    raise AppError(
        "INVALID_FORMAT",
        "Not a product or box QR code.",
        status.HTTP_422_UNPROCESSABLE_ENTITY,
    )
