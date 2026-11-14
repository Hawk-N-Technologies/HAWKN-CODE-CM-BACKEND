from django.conf import settings
from django.db import models

PRODUCT_UID_REGEX = r"^[1-9][0-9]{5}$"
CODE_REGEX = r"^[A-Z0-9][A-Z0-9_-]*$"


def normalize_code(value: str) -> str:
    return (value or "").strip().upper()


class Sku(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ampl_sku"
        ordering = ["code"]
        verbose_name = "SKU"
        verbose_name_plural = "SKUs"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__regex=CODE_REGEX), name="ampl_sku_code_format"
            ),
        ]

    def clean(self):
        # Runs before Django checks constraints (admin and API forms), so
        # "sku001" is accepted and stored as "SKU001".
        super().clean()
        self.code = normalize_code(self.code)

    def save(self, *args, **kwargs):
        self.code = normalize_code(self.code)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class UidBatch(models.Model):
    MAX_QUANTITY = 10000

    sku = models.ForeignKey(Sku, on_delete=models.PROTECT, related_name="batches")
    quantity = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ampl_uid_batch"
        ordering = ["-created_at"]
        verbose_name = "UID batch"
        verbose_name_plural = "UID batches"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1, quantity__lte=10000),
                name="ampl_uid_batch_quantity_range",
            ),
        ]

    def __str__(self) -> str:
        return f"Batch #{self.pk} — {self.sku.code} × {self.quantity}"


class ProductUid(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        IN_BOX = "IN_BOX", "In open box"
        PACKED = "PACKED", "Packed"
        VOID = "VOID", "Void"

    uid = models.CharField(max_length=6, unique=True)
    sku = models.ForeignKey(Sku, on_delete=models.PROTECT, related_name="product_uids")
    batch = models.ForeignKey(UidBatch, on_delete=models.PROTECT, related_name="product_uids")
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.AVAILABLE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    packed_at = models.DateTimeField(null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name="+",
    )
    void_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "ampl_product_uid"
        ordering = ["uid"]
        verbose_name = "product UID"
        verbose_name_plural = "product UIDs"
        indexes = [
            models.Index(fields=["sku", "status"], name="ampl_puid_sku_status_idx"),
            models.Index(fields=["status"], name="ampl_puid_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(uid__regex=PRODUCT_UID_REGEX),
                name="ampl_product_uid_format",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["AVAILABLE", "IN_BOX", "PACKED", "VOID"]),
                name="ampl_product_uid_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status="VOID", voided_at__isnull=False)
                    | (~models.Q(status="VOID") & models.Q(voided_at__isnull=True))
                ),
                name="ampl_product_uid_void_consistent",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status="PACKED", packed_at__isnull=False)
                    | ~models.Q(status="PACKED")
                ),
                name="ampl_product_uid_packed_has_time",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.uid} ({self.sku.code}, {self.status})"
