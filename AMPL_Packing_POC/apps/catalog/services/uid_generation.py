"""
Product UID generation.

Six-digit UIDs 100000-999999 give 900,000 values for the life of the system,
shared by every SKU and never reused.

Method: a counter-driven permutation. Counter value n (0, 1, 2, ...) maps to
    uid = 100000 + ((n * A + B) mod 900000)
Because A shares no factor with 900000, each n gives a different UID, so
collisions cannot happen and UIDs do not look sequential. The unique
constraint in the database is still the final safety net, and any UID that
already exists is skipped automatically.
"""
from math import gcd

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.catalog.models import ProductUid, UidBatch
from apps.common.exceptions import AppError
from apps.common.models import IdCounter

UID_MIN = 100000
UID_SPACE = 900000
COUNTER_NAME = "PRODUCT_UID"
DEFAULT_A = 7919     # prime, shares no factor with 900000 (= 2^5 * 3^2 * 5^5)
DEFAULT_B = 271828


def _permutation_params():
    a = int(getattr(settings, "UID_PERMUTATION_A", DEFAULT_A))
    b = int(getattr(settings, "UID_PERMUTATION_B", DEFAULT_B))
    if a < 1 or gcd(a, UID_SPACE) != 1:
        raise ImproperlyConfigured("UID_PERMUTATION_A must share no factor with 900000.")
    if not 0 <= b < UID_SPACE:
        raise ImproperlyConfigured("UID_PERMUTATION_B must be between 0 and 899999.")
    return a, b


def uid_for_position(n: int) -> str:
    a, b = _permutation_params()
    return str(UID_MIN + ((n * a + b) % UID_SPACE))


def capacity_info() -> dict:
    used = ProductUid.objects.count()
    return {"total": UID_SPACE, "used": used, "remaining": UID_SPACE - used}


def remaining_capacity() -> int:
    return capacity_info()["remaining"]


def generate_uids(*, sku, quantity, user) -> UidBatch:
    """Create one batch of `quantity` new AVAILABLE product UIDs for `sku`."""
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        quantity = 0
    if not 1 <= quantity <= UidBatch.MAX_QUANTITY:
        raise AppError(
            "INVALID_QUANTITY",
            f"Quantity must be between 1 and {UidBatch.MAX_QUANTITY}.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    if not sku.is_active:
        raise AppError("SKU_INACTIVE", f"SKU {sku.code} is inactive.", status.HTTP_409_CONFLICT)

    remaining = remaining_capacity()
    if quantity > remaining:
        raise AppError(
            "CAPACITY_EXCEEDED",
            f"Only {remaining} product UIDs are left in the 6-digit range.",
            status.HTTP_409_CONFLICT,
            extra={"data": {"remaining": remaining}},
        )

    with transaction.atomic():
        batch = UidBatch.objects.create(sku=sku, quantity=quantity, created_by=user)
        needed = quantity
        while needed:
            # Locks the counter row until commit: batches never overlap.
            first = IdCounter.allocate(COUNTER_NAME, needed)
            if first - 1 + needed > UID_SPACE:
                raise AppError(
                    "CAPACITY_EXCEEDED",
                    "The 6-digit product UID range is exhausted.",
                    status.HTTP_409_CONFLICT,
                )
            candidates = [uid_for_position(n - 1) for n in range(first, first + needed)]
            existing = set(
                ProductUid.objects.filter(uid__in=candidates).values_list("uid", flat=True)
            )
            fresh = [uid for uid in candidates if uid not in existing]
            ProductUid.objects.bulk_create(
                [ProductUid(uid=uid, sku=sku, batch=batch) for uid in fresh],
                batch_size=1000,
            )
            needed -= len(fresh)
    return batch


def void_uid(*, product_uid, user, reason) -> ProductUid:
    """Retire an unused UID (e.g. damaged label). Only AVAILABLE UIDs can be voided."""
    reason = (reason or "").strip()
    if not reason:
        raise AppError("REASON_REQUIRED", "Please give a reason.", status.HTTP_422_UNPROCESSABLE_ENTITY)
    with transaction.atomic():
        locked = ProductUid.objects.select_for_update().get(pk=product_uid.pk)
        if locked.status != ProductUid.Status.AVAILABLE:
            raise AppError(
                "UID_NOT_VOIDABLE",
                f"UID {locked.uid} is {locked.get_status_display().lower()} and cannot be voided.",
                status.HTTP_409_CONFLICT,
            )
        locked.status = ProductUid.Status.VOID
        locked.voided_at = timezone.now()
        locked.voided_by = user
        locked.void_reason = reason[:255]
        locked.save(update_fields=["status", "voided_at", "voided_by", "void_reason"])
    return locked
