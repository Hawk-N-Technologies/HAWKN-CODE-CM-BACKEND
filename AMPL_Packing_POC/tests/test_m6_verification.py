"""
M6: look up a box from its label and record verification results.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.packing.models import (
    Box,
    BoxConfiguration,
    BoxConfigurationVersion,
    BoxVerification,
    ConfigurationItem,
    PackingSection,
    ScanLog,
    SectionOperator,
)
from apps.packing.services.box_service import complete_box, scan_product, start_box

PASSWORD = "a-long-test-password"


class VerificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m6admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m6op", password=PASSWORD, first_name="Ravi")
        cls.verifier = User.objects.create_user("m6ver", password=PASSWORD)  # not assigned anywhere
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC2", name="Two")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=3)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        generate_uids(sku=sku, quantity=4, user=cls.admin)
        cls.uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.verifier)

    def completed_box(self):
        box, _ = start_box(section=self.section, user=self.operator)
        for uid in self.uids[:3]:
            scan_product(box=box, raw_value=uid, user=self.operator)
        return complete_box(box=box, user=self.operator)["box"]

    def lookup(self, code):
        return self.client.get("/api/v1/boxes/lookup", {"code": code})

    def verify(self, box, **payload):
        return self.client.post(f"/api/v1/boxes/{box.public_id}/verifications", payload, format="json")

    def test_lookup_returns_full_record(self):
        self.completed_box()
        response = self.lookup("BOX-000001")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual(data["box_uid"], "BOX-000001")
        self.assertEqual(data["status"], "COMPLETED")
        self.assertEqual(data["config"]["label"], "BC2 v1")
        self.assertEqual(data["section"]["code"], "A")
        self.assertEqual(data["completed_by"], "Ravi")
        self.assertIsNotNone(data["completed_at"])
        self.assertEqual(data["progress"]["lines"][0]["expected"], 3)
        self.assertEqual(data["progress"]["lines"][0]["scanned"], 3)
        self.assertEqual(data["progress"]["total_scanned"], 3)
        self.assertEqual(sorted(item["uid"] for item in data["items"]), sorted(self.uids[:3]))
        self.assertEqual(data["verification_status"], "NOT_VERIFIED")
        self.assertEqual(data["basis"], "DATABASE_RECORD")
        self.assertTrue(ScanLog.objects.filter(action="BOX_LOOKUP", accepted=True, box__box_uid="BOX-000001").exists())

    def test_lookup_accepts_lowercase_and_spaces(self):
        self.completed_box()
        self.assertEqual(self.lookup(" box-000001 ").status_code, 200)

    def test_lookup_errors(self):
        self.completed_box()
        cases = [
            (self.uids[0], 422, "IS_PRODUCT_LABEL"),
            ("hello", 422, "INVALID_FORMAT"),
            ("", 422, "INVALID_FORMAT"),
            ("BOX-999999", 404, "BOX_NOT_FOUND"),
        ]
        for code, http_status, error_code in cases:
            with self.subTest(code=code):
                response = self.lookup(code)
                self.assertEqual(response.status_code, http_status)
                self.assertEqual(response.json()["code"], error_code)
        self.assertEqual(ScanLog.objects.filter(action="BOX_LOOKUP", accepted=False).count(), len(cases))

    def test_lookup_requires_login(self):
        self.assertEqual(APIClient().get("/api/v1/boxes/lookup", {"code": "BOX-000001"}).status_code, 401)

    def test_match_marks_box_verified(self):
        box = self.completed_box()
        response = self.verify(box, method="RECORD_CHECK", result="MATCH")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()["data"]
        self.assertEqual(data["status"], "VERIFIED")
        self.assertEqual(data["verification_status"], "VERIFIED")
        self.assertEqual(data["latest_verification"]["method"], "RECORD_CHECK")
        self.assertEqual(len(data["verifications"]), 1)
        self.assertEqual(Box.objects.get(pk=box.pk).status, Box.Status.VERIFIED)

    def test_mismatch_needs_notes_and_flags_box(self):
        box = self.completed_box()
        self.verify(box, method="RECORD_CHECK", result="MATCH")
        missing = self.verify(box, method="PHYSICAL_INSPECTION", result="MISMATCH")
        self.assertEqual(missing.status_code, 422)
        self.assertEqual(missing.json()["code"], "NOTES_REQUIRED")
        response = self.verify(box, method="PHYSICAL_INSPECTION", result="MISMATCH", notes="Only 2 inside")
        data = response.json()["data"]
        self.assertEqual(data["status"], "COMPLETED")
        self.assertEqual(data["verification_status"], "MISMATCH")
        self.assertEqual(data["latest_verification"]["notes"], "Only 2 inside")
        self.assertEqual(len(data["verifications"]), 2)

    def test_invalid_choices(self):
        box = self.completed_box()
        response = self.verify(box, method="GUESS", result="MATCH")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "VALIDATION_ERROR")
        self.assertEqual(BoxVerification.objects.count(), 0)

    def test_open_box_cannot_be_verified(self):
        box, _ = start_box(section=self.section, user=self.operator)
        response = self.verify(box, method="RECORD_CHECK", result="MATCH")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "BOX_NOT_COMPLETED")
