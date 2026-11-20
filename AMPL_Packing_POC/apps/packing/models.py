import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import CODE_REGEX, ProductUid, Sku, normalize_code

BOX_UID_REGEX = r"^BOX-[0-9]{6,}$"
USER = settings.AUTH_USER_MODEL


# ---------------------------------------------------------------------------
# Box configurations (versioned: a version is never changed once used)
# ---------------------------------------------------------------------------
class BoxConfiguration(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        USER, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ampl_box_configuration"
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__regex=CODE_REGEX),
                name="ampl_box_configuration_code_format",
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

    @property
    def latest_version(self):
        return self.versions.order_by("-version_no").first()

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class BoxConfigurationVersion(models.Model):
    configuration = models.ForeignKey(
        BoxConfiguration, on_delete=models.PROTECT, related_name="versions"
    )
    version_no = models.PositiveIntegerField()
    notes = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        USER, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ampl_box_configuration_version"
        ordering = ["configuration__code", "-version_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["configuration", "version_no"],
                name="ampl_config_version_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(version_no__gte=1),
                name="ampl_config_version_no_positive",
            ),
        ]

    @property
    def is_locked(self) -> bool:
        """A version used by any box must never change."""
        return self.boxes.exists()

    @property
    def total_quantity(self) -> int:
        return sum(item.quantity for item in self.items.all())

    def __str__(self) -> str:
        return f"{self.configuration.code} v{self.version_no}"


class ConfigurationItem(models.Model):
    MAX_QUANTITY = 10000

    version = models.ForeignKey(
        BoxConfigurationVersion, on_delete=models.PROTECT, related_name="items"
    )
    sku = models.ForeignKey(Sku, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()

    class Meta:
        db_table = "ampl_configuration_item"
        ordering = ["sku__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["version", "sku"], name="ampl_config_item_sku_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1, quantity__lte=10000),
                name="ampl_config_item_quantity_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sku.code} × {self.quantity}"


# ---------------------------------------------------------------------------
# Packing sections and operator assignments
# ---------------------------------------------------------------------------
class PackingSection(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=200)
    active_config_version = models.ForeignKey(
        BoxConfigurationVersion, on_delete=models.PROTECT, null=True, blank=True,
        related_name="active_in_sections",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ampl_packing_section"
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__regex=CODE_REGEX),
                name="ampl_packing_section_code_format",
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


class SectionOperator(models.Model):
    section = models.ForeignKey(
        PackingSection, on_delete=models.CASCADE, related_name="operator_assignments"
    )
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="section_assignments")
    assigned_by = models.ForeignKey(
        USER, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ampl_section_operator"
        ordering = ["section__code", "user__username"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "user"], name="ampl_section_operator_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} → {self.section.code}"


# ---------------------------------------------------------------------------
# Boxes and their contents
# ---------------------------------------------------------------------------
class Box(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        COMPLETED = "COMPLETED", "Completed"
        VERIFIED = "VERIFIED", "Verified"
        CANCELLED = "CANCELLED", "Cancelled"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    box_uid = models.CharField(max_length=20, unique=True, null=True, blank=True)
    section = models.ForeignKey(PackingSection, on_delete=models.PROTECT, related_name="boxes")
    config_version = models.ForeignKey(
        BoxConfigurationVersion, on_delete=models.PROTECT, related_name="boxes"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)

    opened_by = models.ForeignKey(USER, on_delete=models.PROTECT, related_name="+")
    opened_at = models.DateTimeField(auto_now_add=True)
    completed_by = models.ForeignKey(
        USER, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        USER, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ampl_box"
        ordering = ["-opened_at"]
        verbose_name_plural = "boxes"
        indexes = [
            models.Index(fields=["status", "completed_at"], name="ampl_box_status_done_idx"),
            models.Index(fields=["section", "status"], name="ampl_box_section_status_idx"),
        ]
        constraints = [
            # Only one open box per section at any time.
            models.UniqueConstraint(
                fields=["section"],
                condition=models.Q(status="OPEN"),
                name="ampl_box_one_open_per_section",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["OPEN", "COMPLETED", "VERIFIED", "CANCELLED"]),
                name="ampl_box_status_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(box_uid__isnull=True) | models.Q(box_uid__regex=BOX_UID_REGEX),
                name="ampl_box_uid_format",
            ),
            # Box UID exists exactly when the box is completed or verified.
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status__in=["COMPLETED", "VERIFIED"],
                        box_uid__isnull=False,
                        completed_at__isnull=False,
                    )
                    | models.Q(status__in=["OPEN", "CANCELLED"], box_uid__isnull=True)
                ),
                name="ampl_box_uid_matches_status",
            ),
            models.CheckConstraint(
                condition=models.Q(status="CANCELLED", cancelled_at__isnull=False)
                | ~models.Q(status="CANCELLED"),
                name="ampl_box_cancelled_has_time",
            ),
        ]

    def __str__(self) -> str:
        return self.box_uid or f"Open box {str(self.public_id)[:8]} ({self.section.code})"


class BoxItem(models.Model):
    box = models.ForeignKey(Box, on_delete=models.PROTECT, related_name="items")
    # One-to-one: a product can sit in only one box at a time (database-enforced).
    product_uid = models.OneToOneField(
        ProductUid, on_delete=models.PROTECT, related_name="box_item"
    )
    scanned_by = models.ForeignKey(USER, on_delete=models.PROTECT, related_name="+")
    scanned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ampl_box_item"
        ordering = ["scanned_at"]
        indexes = [models.Index(fields=["box", "scanned_at"], name="ampl_box_item_box_idx")]

    def __str__(self) -> str:
        return f"{self.product_uid.uid} in {self.box}"


class BoxVerification(models.Model):
    class Method(models.TextChoices):
        RECORD_CHECK = "RECORD_CHECK", "Record check (system data only)"
        PHYSICAL_INSPECTION = "PHYSICAL_INSPECTION", "Physical inspection"

    class Result(models.TextChoices):
        MATCH = "MATCH", "Match"
        MISMATCH = "MISMATCH", "Mismatch"

    box = models.ForeignKey(Box, on_delete=models.PROTECT, related_name="verifications")
    method = models.CharField(max_length=24, choices=Method.choices)
    result = models.CharField(max_length=16, choices=Result.choices)
    notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(USER, on_delete=models.PROTECT, related_name="+")
    verified_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ampl_box_verification"
        ordering = ["-verified_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(method__in=["RECORD_CHECK", "PHYSICAL_INSPECTION"]),
                name="ampl_box_verification_method_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(result__in=["MATCH", "MISMATCH"]),
                name="ampl_box_verification_result_valid",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.box} — {self.result} ({self.method})"


# ---------------------------------------------------------------------------
# Audit trail: every scan and box action, accepted or rejected.
# ---------------------------------------------------------------------------
class ScanLog(models.Model):
    class Action(models.TextChoices):
        BOX_START = "BOX_START", "Box started"
        PRODUCT_SCAN = "PRODUCT_SCAN", "Product scanned"
        ITEM_REMOVE = "ITEM_REMOVE", "Item removed"
        BOX_COMPLETE = "BOX_COMPLETE", "Box completed"
        BOX_CANCEL = "BOX_CANCEL", "Box cancelled"
        BOX_LOOKUP = "BOX_LOOKUP", "Box looked up"
        BOX_VERIFY = "BOX_VERIFY", "Box verified"

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(USER, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    section = models.ForeignKey(
        PackingSection, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    box = models.ForeignKey(
        Box, on_delete=models.PROTECT, null=True, blank=True, related_name="scan_logs"
    )
    product_uid = models.ForeignKey(
        ProductUid, on_delete=models.PROTECT, null=True, blank=True, related_name="scan_logs"
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    raw_value = models.CharField(max_length=255, blank=True)
    parsed_value = models.CharField(max_length=32, blank=True)
    accepted = models.BooleanField()
    result_code = models.CharField(max_length=40)
    message = models.CharField(max_length=255, blank=True)
    client_scan_id = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "ampl_scan_log"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["box", "created_at"], name="ampl_scan_log_box_idx"),
            models.Index(fields=["client_scan_id"], name="ampl_scan_log_client_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M:%S} {self.action} {self.result_code}"
