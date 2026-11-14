"""
Packing rules. Every rule is enforced here, on the server, inside database
transactions. The API views (M4) only call these functions.

Locking order (prevents deadlocks): section -> box -> product UID -> counter.
"""
from django.db import IntegrityError, transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status

from apps.catalog.models import ProductUid
from apps.common.exceptions import AppError
from apps.common.models import IdCounter
from apps.packing.models import (
    Box,
    BoxItem,
    ConfigurationItem,
    PackingSection,
    ScanLog,
    SectionOperator,
)
from apps.packing.services.scan_parser import BOX, INVALID, parse_scan

BOX_COUNTER = "BOX"
HTTP_403 = status.HTTP_403_FORBIDDEN
HTTP_404 = status.HTTP_404_NOT_FOUND
HTTP_409 = status.HTTP_409_CONFLICT
HTTP_422 = status.HTTP_422_UNPROCESSABLE_ENTITY


class PackingError(AppError):
    """A packing rule was broken. `error_code` says which one."""


def _fail(code, message, http_status, **extra):
    raise PackingError(code, message, http_status, extra={"data": extra} if extra else None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def format_box_uid(number: int) -> str:
    return f"BOX-{number:06d}"


def user_can_pack(user, section) -> bool:
    if not user or not user.is_active:
        return False
    if getattr(user, "is_ampl_admin", False):
        return True
    return SectionOperator.objects.filter(section_id=section.pk, user_id=user.pk).exists()


def _require_can_pack(user, section):
    if not user_can_pack(user, section):
        _fail("SECTION_NOT_ASSIGNED", "You are not assigned to this packing section.", HTTP_403)


def _lock_box(box) -> Box:
    return (
        Box.objects.select_for_update(of=("self",))
        .select_related("section", "config_version", "config_version__configuration")
        .get(pk=box.pk)
    )


def _require_open(box):
    if box.status != Box.Status.OPEN:
        _fail(
            "BOX_NOT_OPEN",
            f"This box is {box.get_status_display().lower()}. Start a new box.",
            HTTP_409,
            box_status=box.status,
        )


def _log(*, action, accepted, result_code, user, box=None, section_id=None,
         product=None, raw_value="", parsed_value="", message="", client_scan_id=""):
    ScanLog.objects.create(
        action=action,
        accepted=accepted,
        result_code=result_code[:40],
        user=user if getattr(user, "pk", None) else None,
        box_id=getattr(box, "pk", None),
        section_id=section_id if section_id is not None else getattr(box, "section_id", None),
        product_uid=product,
        raw_value=str(raw_value or "")[:255],
        parsed_value=str(parsed_value or "")[:32],
        message=str(message or "")[:255],
        client_scan_id=str(client_scan_id or "")[:64],
    )


def box_progress(box) -> dict:
    """Expected vs scanned quantity per SKU for a box."""
    lines_qs = (
        ConfigurationItem.objects.filter(version_id=box.config_version_id)
        .select_related("sku")
        .order_by("sku__code")
    )
    scanned = dict(
        BoxItem.objects.filter(box_id=box.pk)
        .order_by()
        .values_list("product_uid__sku")
        .annotate(n=Count("id"))
    )
    lines = []
    for item in lines_qs:
        done = scanned.get(item.sku_id, 0)
        lines.append({
            "sku_id": item.sku_id,
            "sku_code": item.sku.code,
            "sku_name": item.sku.name,
            "expected": item.quantity,
            "scanned": done,
            "remaining": max(item.quantity - done, 0),
        })
    total_expected = sum(line["expected"] for line in lines)
    total_scanned = sum(line["scanned"] for line in lines)
    return {
        "lines": lines,
        "total_expected": total_expected,
        "total_scanned": total_scanned,
        "is_complete_ready": total_expected > 0
        and all(line["scanned"] == line["expected"] for line in lines),
    }


# ---------------------------------------------------------------------------
# Start box
# ---------------------------------------------------------------------------
def start_box(*, section, user):
    """
    Open a new box in `section`, or return the box that is already open there.
    Returns (box, created).
    """
    with transaction.atomic():
        locked_section = (
            PackingSection.objects.select_for_update().get(pk=section.pk)
        )
        _require_can_pack(user, locked_section)
        if not locked_section.is_active:
            _fail("SECTION_INACTIVE", "This packing section is inactive.", HTTP_409)

        existing = (
            Box.objects.filter(section_id=locked_section.pk, status=Box.Status.OPEN)
            .select_related("section", "config_version", "config_version__configuration")
            .first()
        )
        if existing:
            return existing, False

        version = locked_section.active_config_version
        if version is None:
            _fail(
                "NO_ACTIVE_CONFIGURATION",
                "No box configuration is assigned to this section. Ask an admin.",
                HTTP_409,
            )
        if not version.configuration.is_active:
            _fail(
                "CONFIG_INACTIVE",
                f"Box configuration {version.configuration.code} is inactive. Ask an admin.",
                HTTP_409,
            )
        if not ConfigurationItem.objects.filter(version_id=version.pk).exists():
            _fail("CONFIG_EMPTY", f"Configuration {version} has no SKUs.", HTTP_409)

        box = Box.objects.create(section=locked_section, config_version=version, opened_by=user)
        _log(
            action=ScanLog.Action.BOX_START, accepted=True, result_code="BOX_STARTED",
            user=user, box=box, message=f"Started with {version}",
        )
    return box, True


# ---------------------------------------------------------------------------
# Scan a product into a box
# ---------------------------------------------------------------------------
def scan_product(*, box, raw_value, user, client_scan_id=""):
    """
    Validate one scanned value and add the product to the box.
    Returns {"accepted", "duplicate_request", "product", "progress"}.
    Raises PackingError (and logs it) when the scan is rejected.
    """
    parsed = parse_scan(raw_value)
    product_for_log = None
    try:
        if parsed.kind == INVALID:
            _fail("INVALID_FORMAT", "Not a product QR code.", HTTP_422)
        if parsed.kind == BOX:
            _fail("IS_BOX_LABEL", "This is a box label, not a product.", HTTP_422)

        with transaction.atomic():
            locked = _lock_box(box)
            _require_can_pack(user, locked.section)
            _require_open(locked)

            # Network retry of a scan that already succeeded: same answer, no error.
            # Only if that same product is still in this box (it may have been removed since).
            previous_log = None
            if client_scan_id:
                previous_log = (
                    ScanLog.objects.filter(
                        box_id=locked.pk, client_scan_id=str(client_scan_id)[:64],
                        action=ScanLog.Action.PRODUCT_SCAN, accepted=True,
                        product_uid__uid=parsed.value,
                    )
                    .select_related("product_uid__sku")
                    .first()
                )
            if previous_log and BoxItem.objects.filter(
                box_id=locked.pk, product_uid_id=previous_log.product_uid_id
            ).exists():
                previous = previous_log.product_uid
                return {
                    "accepted": True,
                    "duplicate_request": True,
                    "product": {"uid": previous.uid, "sku_code": previous.sku.code,
                                "sku_name": previous.sku.name},
                    "progress": box_progress(locked),
                }

            product = (
                ProductUid.objects.select_for_update(of=("self",))
                .select_related("sku")
                .filter(uid=parsed.value)
                .first()
            )
            if product is None:
                _fail("UID_NOT_FOUND", f"Unknown product UID {parsed.value}.", HTTP_404)
            product_for_log = product

            if product.status == ProductUid.Status.VOID:
                _fail("UID_VOID", f"UID {product.uid} was voided and cannot be packed.", HTTP_409)

            current = (
                BoxItem.objects.select_related("box", "box__section")
                .filter(product_uid_id=product.pk)
                .first()
            )
            if current is not None:
                if current.box_id == locked.pk:
                    _fail("ALREADY_IN_THIS_BOX", f"UID {product.uid} is already in this box.", HTTP_409)
                if current.box.box_uid or product.status == ProductUid.Status.PACKED:
                    _fail(
                        "ALREADY_PACKED",
                        f"UID {product.uid} is already packed in {current.box.box_uid}.",
                        HTTP_409, box_uid=current.box.box_uid,
                    )
                _fail(
                    "IN_OTHER_BOX",
                    f"UID {product.uid} is in an open box in section {current.box.section.code}.",
                    HTTP_409, section_code=current.box.section.code,
                )
            if product.status == ProductUid.Status.PACKED:
                _fail("ALREADY_PACKED", f"UID {product.uid} is already packed.", HTTP_409)

            line = ConfigurationItem.objects.filter(
                version_id=locked.config_version_id, sku_id=product.sku_id
            ).first()
            if line is None:
                _fail(
                    "SKU_NOT_IN_CONFIG",
                    f"{product.sku.code} is not part of {locked.config_version}.",
                    HTTP_422, sku_code=product.sku.code,
                )
            already = BoxItem.objects.filter(
                box_id=locked.pk, product_uid__sku=product.sku_id
            ).count()
            if already >= line.quantity:
                _fail(
                    "SKU_QUANTITY_FULL",
                    f"{product.sku.code} is already at {line.quantity}/{line.quantity}.",
                    HTTP_409, sku_code=product.sku.code, expected=line.quantity,
                )

            try:
                with transaction.atomic():
                    BoxItem.objects.create(box=locked, product_uid=product, scanned_by=user)
            except IntegrityError:
                # Another request packed this product at the same moment.
                _fail("IN_OTHER_BOX", f"UID {product.uid} was just added to another box.", HTTP_409)

            ProductUid.objects.filter(pk=product.pk).update(status=ProductUid.Status.IN_BOX)
            _log(
                action=ScanLog.Action.PRODUCT_SCAN, accepted=True, result_code="ACCEPTED",
                user=user, box=locked, product=product, raw_value=raw_value,
                parsed_value=parsed.value, client_scan_id=client_scan_id,
            )
            return {
                "accepted": True,
                "duplicate_request": False,
                "product": {"uid": product.uid, "sku_code": product.sku.code,
                            "sku_name": product.sku.name},
                "progress": box_progress(locked),
            }
    except PackingError as exc:
        _log(
            action=ScanLog.Action.PRODUCT_SCAN, accepted=False, result_code=exc.error_code,
            user=user, box=box, product=product_for_log, raw_value=raw_value,
            parsed_value=parsed.value, message=str(exc.detail), client_scan_id=client_scan_id,
        )
        raise


# ---------------------------------------------------------------------------
# Remove a wrongly scanned product from an open box
# ---------------------------------------------------------------------------
def remove_item(*, box, uid, user, reason=""):
    parsed = parse_scan(uid)
    with transaction.atomic():
        locked = _lock_box(box)
        _require_can_pack(user, locked.section)
        _require_open(locked)
        item = (
            BoxItem.objects.select_related("product_uid")
            .filter(box_id=locked.pk, product_uid__uid=parsed.value)
            .first()
        )
        if item is None:
            _fail("ITEM_NOT_IN_BOX", f"UID {parsed.value} is not in this box.", HTTP_404)
        product = item.product_uid
        item.delete()
        ProductUid.objects.filter(pk=product.pk).update(status=ProductUid.Status.AVAILABLE)
        _log(
            action=ScanLog.Action.ITEM_REMOVE, accepted=True, result_code="REMOVED",
            user=user, box=locked, product=product, parsed_value=product.uid,
            message=(reason or "").strip()[:255],
        )
        return {"removed_uid": product.uid, "progress": box_progress(locked)}


# ---------------------------------------------------------------------------
# Complete a box (atomic and idempotent)
# ---------------------------------------------------------------------------
def complete_box(*, box, user):
    """
    Finalise a full box and give it the next BOX-NNNNNN number.
    Calling it again for a completed box returns the same box (no new number).
    Returns {"box", "already_completed", "progress"}.
    """
    try:
        with transaction.atomic():
            locked = _lock_box(box)
            _require_can_pack(user, locked.section)

            if locked.status in (Box.Status.COMPLETED, Box.Status.VERIFIED):
                return {"box": locked, "already_completed": True, "progress": box_progress(locked)}
            _require_open(locked)

            progress = box_progress(locked)
            if not progress["is_complete_ready"]:
                short = [
                    f"{line['sku_code']} {line['scanned']}/{line['expected']}"
                    for line in progress["lines"] if line["scanned"] != line["expected"]
                ]
                _fail(
                    "COUNTS_INCOMPLETE",
                    "Box is not complete: " + ", ".join(short) + ".",
                    HTTP_409, progress=progress,
                )

            # Numbers are taken only after every check passed, inside this
            # transaction, so a failure never wastes a number.
            now = timezone.now()
            locked.box_uid = format_box_uid(IdCounter.allocate(BOX_COUNTER))
            locked.status = Box.Status.COMPLETED
            locked.completed_by = user
            locked.completed_at = now
            locked.save(update_fields=["box_uid", "status", "completed_by", "completed_at", "updated_at"])
            ProductUid.objects.filter(box_item__box=locked).update(
                status=ProductUid.Status.PACKED, packed_at=now
            )
            _log(
                action=ScanLog.Action.BOX_COMPLETE, accepted=True, result_code="COMPLETED",
                user=user, box=locked, parsed_value=locked.box_uid,
                message=f"{progress['total_scanned']} items",
            )
            return {"box": locked, "already_completed": False, "progress": progress}
    except PackingError as exc:
        _log(
            action=ScanLog.Action.BOX_COMPLETE, accepted=False, result_code=exc.error_code,
            user=user, box=box, message=str(exc.detail),
        )
        raise


# ---------------------------------------------------------------------------
# Cancel an open box
# ---------------------------------------------------------------------------
def cancel_box(*, box, user, reason):
    reason = (reason or "").strip()
    if not reason:
        _fail("REASON_REQUIRED", "Please give a reason for cancelling.", HTTP_422)
    with transaction.atomic():
        locked = _lock_box(box)
        _require_can_pack(user, locked.section)
        _require_open(locked)
        product_ids = list(
            BoxItem.objects.filter(box_id=locked.pk).values_list("product_uid_id", flat=True)
        )
        BoxItem.objects.filter(box_id=locked.pk).delete()
        ProductUid.objects.filter(pk__in=product_ids).update(status=ProductUid.Status.AVAILABLE)
        locked.status = Box.Status.CANCELLED
        locked.cancelled_by = user
        locked.cancelled_at = timezone.now()
        locked.cancel_reason = reason[:255]
        locked.save(update_fields=["status", "cancelled_by", "cancelled_at", "cancel_reason", "updated_at"])
        _log(
            action=ScanLog.Action.BOX_CANCEL, accepted=True, result_code="CANCELLED",
            user=user, box=locked, message=f"{len(product_ids)} items released: {reason}",
        )
    return locked
