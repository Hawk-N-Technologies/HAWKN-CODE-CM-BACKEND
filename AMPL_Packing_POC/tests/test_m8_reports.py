"""
M8: dashboard counters, packing history and scan log.
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids, void_uid
from apps.common.exceptions import AppError
from apps.packing.models import (
    BoxConfiguration,
    BoxConfigurationVersion,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)
from apps.packing.services.box_service import cancel_box, complete_box, scan_product, start_box
from apps.packing.services.verification_service import record_verification

PASSWORD = "a-long-test-password"


class ReportsTests(TestCase):
    """
    Data: 10 UIDs, quantity 2 per box.
      BOX-000001 completed (not verified), BOX-000002 verified (match),
      BOX-000003 completed with a mismatch, one cancelled box, one open box with 1 item,
      1 UID voided.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m8admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m8op", password=PASSWORD, first_name="Asha")
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC2", name="Two")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=2)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        cls.section_b = PackingSection.objects.create(code="B", name="Section B", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        generate_uids(sku=sku, quantity=10, user=cls.admin)
        uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))

        def pack(values):
            box, _ = start_box(section=cls.section, user=cls.operator)
            for value in values:
                scan_product(box=box, raw_value=value, user=cls.operator)
            return box

        complete_box(box=pack(uids[0:2]), user=cls.operator)
        cls.verified = complete_box(box=pack(uids[2:4]), user=cls.operator)["box"]
        record_verification(box=cls.verified, user=cls.admin, method="RECORD_CHECK", result="MATCH")
        cls.mismatch = complete_box(box=pack(uids[4:6]), user=cls.operator)["box"]
        record_verification(box=cls.mismatch, user=cls.admin, method="PHYSICAL_INSPECTION",
                            result="MISMATCH", notes="one missing")
        cancel_box(box=pack(uids[6:7]), user=cls.operator, reason="torn carton")
        pack([uids[7]])  # stays open
        void_uid(product_uid=ProductUid.objects.get(uid=uids[9]), user=cls.admin, reason="damaged")
        # Two rejected scans for the scan log
        open_box, _ = start_box(section=cls.section, user=cls.operator)
        for bad in ("hello", uids[7]):
            try:
                scan_product(box=open_box, raw_value=bad, user=cls.operator)
            except AppError:
                pass

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.admin)

    def history(self, **params):
        return self.client.get("/api/v1/boxes", params)

    def test_dashboard_counts(self):
        data = self.client.get("/api/v1/dashboard/summary").json()["data"]
        self.assertEqual(data["product_uids"], {"total": 10, "available": 2, "in_box": 1, "packed": 6, "void": 1})
        self.assertEqual(data["boxes"], {"open": 1, "completed": 3, "verified": 1, "mismatch": 1,
                                         "not_verified": 1, "cancelled": 1})
        self.assertEqual(data["today"]["boxes_completed"], 3)
        self.assertEqual(data["today"]["products_packed"], 6)
        self.assertEqual(data["uid_capacity"]["used"], 10)

    def test_history_lists_all_boxes_newest_first(self):
        body = self.history().json()
        self.assertEqual(body["pagination"]["total_items"], 5)
        rows = body["data"]
        self.assertEqual(rows[0]["status"], "OPEN")
        done = {row["box_uid"]: row for row in rows if row["box_uid"]}
        self.assertEqual(set(done), {"BOX-000001", "BOX-000002", "BOX-000003"})
        self.assertEqual(done["BOX-000001"]["verification_status"], "NOT_VERIFIED")
        self.assertEqual(done["BOX-000002"]["verification_status"], "VERIFIED")
        self.assertEqual(done["BOX-000003"]["verification_status"], "MISMATCH")
        self.assertEqual(done["BOX-000001"]["quantity"], 2)
        self.assertEqual(done["BOX-000001"]["expected"], 2)
        self.assertEqual(done["BOX-000001"]["configuration"], "BC2 v1")
        self.assertEqual(done["BOX-000001"]["operator"], "Asha")
        cancelled = [row for row in rows if row["status"] == "CANCELLED"][0]
        self.assertEqual(cancelled["cancel_reason"], "torn carton")

    def test_history_filters(self):
        def total(**params):
            return self.history(**params).json()["pagination"]["total_items"]

        self.assertEqual(total(status="verified"), 1)
        self.assertEqual(total(status="COMPLETED"), 2)
        self.assertEqual(total(status="MISMATCH"), 1)
        self.assertEqual(total(status="OPEN"), 1)
        self.assertEqual(total(status="CANCELLED"), 1)
        self.assertEqual(total(section=self.section.pk), 5)
        self.assertEqual(total(section=self.section_b.pk), 0)
        self.assertEqual(total(operator=self.operator.pk), 5)
        self.assertEqual(total(q="000002"), 1)
        today = timezone.localdate()
        self.assertEqual(total(date_from=today.isoformat(), date_to=today.isoformat()), 5)
        self.assertEqual(total(date_from=(today + timedelta(days=1)).isoformat()), 0)

    def test_invalid_date(self):
        response = self.history(date_from="14-11-2026")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "INVALID_DATE")

    def test_scan_log_filters(self):
        rejected = self.client.get("/api/v1/scan-logs", {"accepted": "false"}).json()
        codes = sorted(row["result_code"] for row in rejected["data"])
        self.assertEqual(codes, ["ALREADY_IN_THIS_BOX", "INVALID_FORMAT"])
        accepted_scans = self.client.get("/api/v1/scan-logs", {"accepted": "true", "action": "PRODUCT_SCAN"}).json()
        self.assertEqual(accepted_scans["pagination"]["total_items"], 8)
        completions = self.client.get("/api/v1/scan-logs", {"action": "box_complete"}).json()
        self.assertEqual(completions["pagination"]["total_items"], 3)
        found = self.client.get("/api/v1/scan-logs", {"q": "BOX-000002"}).json()
        self.assertTrue(all(row["box_uid"] == "BOX-000002" for row in found["data"]))
        self.assertGreater(found["pagination"]["total_items"], 0)

    def test_admin_only(self):
        operator = APIClient()
        operator.force_login(self.operator)
        for url in ("/api/v1/dashboard/summary", "/api/v1/boxes", "/api/v1/scan-logs"):
            with self.subTest(url=url):
                self.assertEqual(operator.get(url).status_code, 403)
        self.assertEqual(APIClient().get("/api/v1/boxes").status_code, 401)
