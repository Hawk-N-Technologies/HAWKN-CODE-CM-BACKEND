"""
M2: every packing rule, UID generation and the scan log.
"""
import re
from unittest import mock

from django.test import TestCase

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services import uid_generation
from apps.catalog.services.uid_generation import capacity_info, generate_uids, void_uid
from apps.common.exceptions import AppError
from apps.common.models import IdCounter
from apps.packing.models import (
    Box,
    BoxConfiguration,
    BoxConfigurationVersion,
    BoxItem,
    ConfigurationItem,
    PackingSection,
    ScanLog,
    SectionOperator,
)
from apps.packing.services.box_service import (
    box_progress,
    cancel_box,
    complete_box,
    remove_item,
    scan_product,
    start_box,
)
from apps.packing.services.scan_parser import BOX, INVALID, PRODUCT, parse_scan

PASSWORD = "a-long-test-password"


class PackingFixture(TestCase):
    """SKU001 x3 per box (BC3) in Section A; SKU002 exists but is not in BC3."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m2admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m2op", password=PASSWORD)
        cls.outsider = User.objects.create_user("m2out", password=PASSWORD)
        cls.sku1 = Sku.objects.create(code="SKU001", name="Product One")
        cls.sku2 = Sku.objects.create(code="SKU002", name="Product Two")
        config = BoxConfiguration.objects.create(code="BC3", name="Three of SKU001")
        cls.version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=cls.version, sku=cls.sku1, quantity=3)
        cls.section = PackingSection.objects.create(
            code="A", name="Section A", active_config_version=cls.version
        )
        cls.section_b = PackingSection.objects.create(
            code="B", name="Section B", active_config_version=cls.version
        )
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        cls.batch1 = generate_uids(sku=cls.sku1, quantity=10, user=cls.admin)
        cls.batch2 = generate_uids(sku=cls.sku2, quantity=2, user=cls.admin)

    def uids(self, sku=None):
        sku = sku or self.sku1
        return list(
            ProductUid.objects.filter(sku=sku).order_by("id").values_list("uid", flat=True)
        )

    def new_box(self, section=None, user=None):
        box, _ = start_box(section=section or self.section, user=user or self.operator)
        return box

    def scan(self, box, value, user=None, client_scan_id=""):
        return scan_product(
            box=box, raw_value=value, user=user or self.operator, client_scan_id=client_scan_id
        )

    def fill(self, box, count=3):
        for uid in self.uids()[:count]:
            self.scan(box, uid)

    def assertRejected(self, code, func, *args, **kwargs):
        with self.assertRaises(AppError) as ctx:
            func(*args, **kwargs)
        self.assertEqual(ctx.exception.error_code, code, str(ctx.exception.detail))
        return ctx.exception


# ---------------------------------------------------------------------------
class ScanParserTests(TestCase):
    def test_kinds(self):
        self.assertEqual(parse_scan("483921").kind, PRODUCT)
        self.assertEqual(parse_scan(" 483921\n").kind, PRODUCT)
        self.assertEqual(parse_scan("box-000001").kind, BOX)
        self.assertEqual(parse_scan("BOX-000001").value, "BOX-000001")
        for bad in ("", None, "012345", "12345", "1234567", "BOX-1", "hello", "48392A"):
            with self.subTest(value=bad):
                self.assertEqual(parse_scan(bad).kind, INVALID)


# ---------------------------------------------------------------------------
class UidGenerationTests(PackingFixture):
    def test_generates_unique_six_digit_uids(self):
        batch = generate_uids(sku=self.sku1, quantity=25, user=self.admin)
        uids = list(batch.product_uids.values_list("uid", flat=True))
        self.assertEqual(len(uids), 25)
        self.assertEqual(len(set(uids)), 25)
        self.assertTrue(all(re.fullmatch(r"[1-9][0-9]{5}", u) for u in uids))
        self.assertFalse(batch.product_uids.exclude(status=ProductUid.Status.AVAILABLE).exists())
        self.assertEqual(ProductUid.objects.count(), 37)  # 10 + 2 from fixture

    def test_permutation_has_no_collisions_over_many_positions(self):
        values = {uid_generation.uid_for_position(n) for n in range(20000)}
        self.assertEqual(len(values), 20000)

    def test_quantity_limits(self):
        for bad in (0, -1, 10001, "abc", None):
            with self.subTest(quantity=bad):
                self.assertRejected("INVALID_QUANTITY", generate_uids,
                                    sku=self.sku1, quantity=bad, user=self.admin)

    def test_capacity_exceeded(self):
        with mock.patch.object(uid_generation, "remaining_capacity", return_value=5):
            self.assertRejected("CAPACITY_EXCEEDED", generate_uids,
                                sku=self.sku1, quantity=6, user=self.admin)

    def test_inactive_sku_rejected(self):
        self.sku2.is_active = False
        self.sku2.save()
        self.assertRejected("SKU_INACTIVE", generate_uids, sku=self.sku2, quantity=1, user=self.admin)

    def test_capacity_info(self):
        info = capacity_info()
        self.assertEqual(info, {"total": 900000, "used": 12, "remaining": 899988})

    def test_void_only_available(self):
        uid = ProductUid.objects.get(uid=self.uids()[0])
        voided = void_uid(product_uid=uid, user=self.admin, reason="Label damaged")
        self.assertEqual(voided.status, ProductUid.Status.VOID)
        self.assertRejected("UID_NOT_VOIDABLE", void_uid,
                            product_uid=uid, user=self.admin, reason="again")
        self.assertRejected("REASON_REQUIRED", void_uid,
                            product_uid=uid, user=self.admin, reason=" ")


# ---------------------------------------------------------------------------
class StartBoxTests(PackingFixture):
    def test_start_is_idempotent(self):
        box, created = start_box(section=self.section, user=self.operator)
        again, created_again = start_box(section=self.section, user=self.operator)
        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(box.pk, again.pk)
        self.assertEqual(box.config_version_id, self.version.pk)

    def test_unassigned_operator_blocked(self):
        self.assertRejected("SECTION_NOT_ASSIGNED", start_box, section=self.section, user=self.outsider)

    def test_admin_can_start_anywhere(self):
        box, created = start_box(section=self.section_b, user=self.admin)
        self.assertTrue(created)

    def test_no_active_configuration(self):
        empty = PackingSection.objects.create(code="C", name="Section C")
        self.assertRejected("NO_ACTIVE_CONFIGURATION", start_box, section=empty, user=self.admin)

    def test_inactive_section(self):
        self.section.is_active = False
        self.section.save()
        self.assertRejected("SECTION_INACTIVE", start_box, section=self.section, user=self.operator)


# ---------------------------------------------------------------------------
class ScanRuleTests(PackingFixture):
    def test_valid_scan_updates_progress_and_status(self):
        box = self.new_box()
        uid = self.uids()[0]
        result = self.scan(box, uid)
        self.assertTrue(result["accepted"])
        self.assertEqual(result["product"]["sku_code"], "SKU001")
        self.assertEqual(result["progress"]["total_scanned"], 1)
        self.assertEqual(result["progress"]["lines"][0]["remaining"], 2)
        self.assertEqual(ProductUid.objects.get(uid=uid).status, ProductUid.Status.IN_BOX)

    def test_invalid_format(self):
        self.assertRejected("INVALID_FORMAT", self.scan, self.new_box(), "hello")

    def test_box_label_rejected(self):
        self.assertRejected("IS_BOX_LABEL", self.scan, self.new_box(), "BOX-000001")

    def test_unknown_uid(self):
        known = set(self.uids()) | set(self.uids(self.sku2))
        unknown = next(str(n) for n in range(100000, 100100) if str(n) not in known)
        self.assertRejected("UID_NOT_FOUND", self.scan, self.new_box(), unknown)

    def test_void_uid(self):
        uid = ProductUid.objects.get(uid=self.uids()[0])
        void_uid(product_uid=uid, user=self.admin, reason="damaged")
        self.assertRejected("UID_VOID", self.scan, self.new_box(), uid.uid)

    def test_duplicate_scan_in_same_box(self):
        box = self.new_box()
        uid = self.uids()[0]
        self.scan(box, uid)
        self.assertRejected("ALREADY_IN_THIS_BOX", self.scan, box, uid)

    def test_uid_in_other_open_box(self):
        uid = self.uids()[0]
        other = self.new_box(section=self.section_b, user=self.admin)
        self.scan(other, uid, user=self.admin)
        self.assertRejected("IN_OTHER_BOX", self.scan, self.new_box(), uid)

    def test_already_packed(self):
        box = self.new_box()
        self.fill(box)
        complete_box(box=box, user=self.operator)
        next_box = self.new_box()
        error = self.assertRejected("ALREADY_PACKED", self.scan, next_box, self.uids()[0])
        self.assertIn("BOX-000001", str(error.detail))

    def test_wrong_sku(self):
        self.assertRejected("SKU_NOT_IN_CONFIG", self.scan, self.new_box(), self.uids(self.sku2)[0])

    def test_excess_quantity(self):
        box = self.new_box()
        self.fill(box, 3)
        self.assertRejected("SKU_QUANTITY_FULL", self.scan, box, self.uids()[3])
        self.assertEqual(box_progress(box)["total_scanned"], 3)

    def test_scan_into_completed_box(self):
        box = self.new_box()
        self.fill(box)
        complete_box(box=box, user=self.operator)
        self.assertRejected("BOX_NOT_OPEN", self.scan, box, self.uids()[5])

    def test_unassigned_user_cannot_scan(self):
        box = self.new_box()
        self.assertRejected("SECTION_NOT_ASSIGNED", self.scan, box, self.uids()[0], user=self.outsider)

    def test_rejections_are_logged(self):
        box = self.new_box()
        for value in ("hello", "BOX-000009"):
            with self.assertRaises(AppError):
                self.scan(box, value)
        rejected = ScanLog.objects.filter(box=box, action=ScanLog.Action.PRODUCT_SCAN, accepted=False)
        self.assertEqual(
            sorted(rejected.values_list("result_code", flat=True)),
            ["INVALID_FORMAT", "IS_BOX_LABEL"],
        )

    def test_network_retry_returns_same_result(self):
        box = self.new_box()
        uid = self.uids()[0]
        first = self.scan(box, uid, client_scan_id="scan-1")
        second = self.scan(box, uid, client_scan_id="scan-1")
        self.assertFalse(first["duplicate_request"])
        self.assertTrue(second["duplicate_request"])
        self.assertEqual(BoxItem.objects.filter(box=box).count(), 1)


# ---------------------------------------------------------------------------
class RemoveItemTests(PackingFixture):
    def test_remove_releases_product(self):
        box = self.new_box()
        uid = self.uids()[0]
        self.scan(box, uid)
        result = remove_item(box=box, uid=uid, user=self.operator, reason="wrong item")
        self.assertEqual(result["progress"]["total_scanned"], 0)
        self.assertEqual(ProductUid.objects.get(uid=uid).status, ProductUid.Status.AVAILABLE)
        self.scan(box, uid)  # can be scanned again

    def test_remove_unknown_item(self):
        self.assertRejected("ITEM_NOT_IN_BOX", remove_item,
                            box=self.new_box(), uid=self.uids()[0], user=self.operator)


# ---------------------------------------------------------------------------
class CompleteBoxTests(PackingFixture):
    def test_incomplete_box_cannot_complete_and_uses_no_number(self):
        box = self.new_box()
        self.fill(box, 2)
        error = self.assertRejected("COUNTS_INCOMPLETE", complete_box, box=box, user=self.operator)
        self.assertIn("SKU001 2/3", str(error.detail))
        self.assertFalse(IdCounter.objects.filter(name="BOX").exists())
        box.refresh_from_db()
        self.assertEqual(box.status, Box.Status.OPEN)

    def test_complete_box(self):
        box = self.new_box()
        self.fill(box)
        result = complete_box(box=box, user=self.operator)
        done = result["box"]
        self.assertFalse(result["already_completed"])
        self.assertEqual(done.box_uid, "BOX-000001")
        self.assertEqual(done.status, Box.Status.COMPLETED)
        packed = ProductUid.objects.filter(box_item__box=done)
        self.assertEqual(packed.count(), 3)
        self.assertFalse(packed.exclude(status=ProductUid.Status.PACKED).exists())
        self.assertFalse(packed.filter(packed_at__isnull=True).exists())

    def test_repeat_completion_returns_same_box(self):
        box = self.new_box()
        self.fill(box)
        first = complete_box(box=box, user=self.operator)
        second = complete_box(box=box, user=self.operator)
        self.assertTrue(second["already_completed"])
        self.assertEqual(first["box"].box_uid, second["box"].box_uid)
        self.assertEqual(IdCounter.objects.get(name="BOX").next_value, 2)

    def test_numbers_are_sequential_and_new_box_can_start(self):
        first = self.new_box()
        self.fill(first)
        complete_box(box=first, user=self.operator)
        second = self.new_box()
        self.assertNotEqual(first.pk, second.pk)
        for uid in self.uids()[3:6]:
            self.scan(second, uid)
        self.assertEqual(complete_box(box=second, user=self.operator)["box"].box_uid, "BOX-000002")


# ---------------------------------------------------------------------------
class CancelBoxTests(PackingFixture):
    def test_cancel_releases_items_and_keeps_numbers_gapless(self):
        box = self.new_box()
        self.fill(box, 2)
        cancelled = cancel_box(box=box, user=self.operator, reason="Damaged carton")
        self.assertEqual(cancelled.status, Box.Status.CANCELLED)
        self.assertIsNone(cancelled.box_uid)
        self.assertFalse(BoxItem.objects.filter(box=box).exists())
        self.assertEqual(
            ProductUid.objects.filter(uid__in=self.uids()[:2], status=ProductUid.Status.AVAILABLE).count(), 2
        )
        replacement = self.new_box()
        self.fill(replacement)
        self.assertEqual(complete_box(box=replacement, user=self.operator)["box"].box_uid, "BOX-000001")

    def test_reason_required(self):
        self.assertRejected("REASON_REQUIRED", cancel_box, box=self.new_box(), user=self.operator, reason="")

    def test_cannot_cancel_completed_box(self):
        box = self.new_box()
        self.fill(box)
        complete_box(box=box, user=self.operator)
        self.assertRejected("BOX_NOT_OPEN", cancel_box, box=box, user=self.operator, reason="late")
