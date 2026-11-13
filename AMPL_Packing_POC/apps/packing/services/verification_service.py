"""
Box verification.

Scanning the box label checks the box against the DATABASE RECORD (what was
scanned in at packing time). It does not prove what is physically inside;
that needs a physical inspection, recorded with method PHYSICAL_INSPECTION.
"""
from django.db import transaction
from rest_framework import status

from apps.common.exceptions import AppError
from apps.packing.models import Box, BoxVerification, ScanLog
from apps.packing.services.box_service import _log
from apps.packing.services.scan_parser import BOX, PRODUCT, parse_scan

DONE_STATUSES = (Box.Status.COMPLETED, Box.Status.VERIFIED)
BOX_RELATED = (
    "section", "config_version", "config_version__configuration",
    "opened_by", "completed_by",
)


def lookup_box(*, raw_value, user) -> Box:
    """Find a completed box from a scanned/typed box label. Every lookup is logged."""
    parsed = parse_scan(raw_value)
    try:
        if parsed.kind == PRODUCT:
            raise AppError(
                "IS_PRODUCT_LABEL",
                "This is a product label. Scan the label on the box.",
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if parsed.kind != BOX:
            raise AppError("INVALID_FORMAT", "Not a box QR code.", status.HTTP_422_UNPROCESSABLE_ENTITY)
        box = Box.objects.select_related(*BOX_RELATED).filter(box_uid=parsed.value).first()
        if box is None:
            raise AppError("BOX_NOT_FOUND", f"Box {parsed.value} is not in the system.", status.HTTP_404_NOT_FOUND)
    except AppError as exc:
        _log(
            action=ScanLog.Action.BOX_LOOKUP, accepted=False, result_code=exc.error_code,
            user=user, raw_value=raw_value, parsed_value=parsed.value, message=str(exc.detail),
        )
        raise
    _log(
        action=ScanLog.Action.BOX_LOOKUP, accepted=True, result_code="FOUND",
        user=user, box=box, raw_value=raw_value, parsed_value=parsed.value,
    )
    return box


def record_verification(*, box, user, method, result, notes="") -> Box:
    """
    Save a verification result.
    MATCH    -> box becomes VERIFIED.
    MISMATCH -> box stays (or goes back to) COMPLETED, and notes are required.
    """
    notes = (notes or "").strip()
    if result == BoxVerification.Result.MISMATCH and not notes:
        raise AppError(
            "NOTES_REQUIRED",
            "Describe what does not match.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    with transaction.atomic():
        locked = Box.objects.select_for_update(of=("self",)).select_related(*BOX_RELATED).get(pk=box.pk)
        if locked.status not in DONE_STATUSES:
            raise AppError(
                "BOX_NOT_COMPLETED",
                "Only a completed box can be verified.",
                status.HTTP_409_CONFLICT,
            )
        BoxVerification.objects.create(
            box=locked, method=method, result=result, notes=notes, verified_by=user
        )
        new_status = Box.Status.VERIFIED if result == BoxVerification.Result.MATCH else Box.Status.COMPLETED
        if locked.status != new_status:
            locked.status = new_status
            locked.save(update_fields=["status", "updated_at"])
        _log(
            action=ScanLog.Action.BOX_VERIFY, accepted=True, result_code=result,
            user=user, box=locked, parsed_value=locked.box_uid,
            message=f"{method}: {notes}" if notes else method,
        )
    return locked
