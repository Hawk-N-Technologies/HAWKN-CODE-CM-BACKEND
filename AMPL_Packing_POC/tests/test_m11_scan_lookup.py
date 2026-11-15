"""
M11: "Scan box / item" lookup, and box verification removed.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.packing.models import (
    BoxConfiguration,
    BoxConfigurationVersion,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)
from apps.packing.services.box_service import complete_box, scan_product, start_box

PASSWORD = "a-long-test-password"


class ScanLookupTests(TestCase):
    """
    Data: SKU001, 3 per box, 5 UIDs.
      uids[0:3] packed in BOX-000001, uids[3] in an open box, uids[4] not packed.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m11admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m11op", password=PASSWORD, first_name="Ravi")
        cls.outsider = User.objects.create_user("m11other", password=PASSWORD)  # no section
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC3", name="Three")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=3)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        generate_uids(sku=sku, quantity=5, user=cls.admin)
        cls.uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))

        box, _ = start_box(section=cls.section, user=cls.operator)
        for uid in cls.uids[:3]:
            scan_product(box=box, raw_value=uid, user=cls.operator)
        cls.packed_box = complete_box(box=box, user=cls.operator)["box"]
        cls.open_box, _ = start_box(section=cls.section, user=cls.operator)
        scan_product(box=cls.open_box, raw_value=cls.uids[3], user=cls.operator)

    def lookup(self, code, user=None):
        client = APIClient()
        client.force_login(user or self.operator)
        return client.get("/api/v1/lookup", {"code": code})

    def test_packed_item_shows_its_box(self):
        response = self.lookup(self.uids[0])
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual(data["kind"], "ITEM")
        item = data["item"]
        self.assertEqual(item["uid"], self.uids[0])
        self.assertEqual((item["sku_code"], item["sku_name"]), ("SKU001", "Product One"))
        self.assertTrue(item["packed"])
        self.assertEqual(item["status"], "PACKED")
        self.assertIsNotNone(item["packed_at"])
        self.assertEqual(item["box"]["box_uid"], "BOX-000001")
        self.assertEqual(item["box"]["public_id"], str(self.packed_box.public_id))

    def test_item_in_open_box(self):
        item = self.lookup(self.uids[3]).json()["data"]["item"]
        self.assertFalse(item["packed"])
        self.assertEqual(item["status"], "IN_BOX")
        self.assertIsNone(item["box"]["box_uid"])
        self.assertEqual(item["box"]["section_code"], "A")

    def test_item_not_packed_yet(self):
        item = self.lookup(self.uids[4]).json()["data"]["item"]
        self.assertFalse(item["packed"])
        self.assertEqual(item["status"], "AVAILABLE")
        self.assertIsNone(item["box"])
        self.assertIsNone(item["packed_at"])

    def test_box_shows_all_items(self):
        data = self.lookup(" box-000001 ").json()["data"]  # typed in lower case with spaces
        self.assertEqual(data["kind"], "BOX")
        box = data["box"]
        self.assertEqual(box["box_uid"], "BOX-000001")
        self.assertEqual(box["status"], "COMPLETED")
        self.assertEqual(sorted(item["uid"] for item in box["items"]), sorted(self.uids[:3]))
        self.assertEqual(box["completed_by"], "Ravi")
        self.assertIsNotNone(box["completed_at"])
        self.assertEqual(box["config"]["label"], "BC3 v1")
        self.assertTrue(box["can_print"])

    def test_anyone_can_look_up_but_only_section_users_reprint(self):
        response = self.lookup("BOX-000001", user=self.outsider)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["data"]["box"]["can_print"])
        self.assertTrue(self.lookup("BOX-000001", user=self.admin).json()["data"]["box"]["can_print"])

    def test_errors(self):
        cases = [
            ("999999" if "999999" not in self.uids else "100000", 404, "UID_NOT_FOUND"),
            ("BOX-999999", 404, "BOX_NOT_FOUND"),
            ("hello", 422, "INVALID_FORMAT"),
            ("", 422, "INVALID_FORMAT"),
        ]
        for code, http_status, error_code in cases:
            with self.subTest(code=code):
                response = self.lookup(code)
                self.assertEqual(response.status_code, http_status)
                self.assertEqual(response.json()["code"], error_code)

    def test_login_required(self):
        self.assertEqual(APIClient().get("/api/v1/lookup", {"code": "BOX-000001"}).status_code, 401)

    def test_verification_endpoints_removed(self):
        client = APIClient()
        client.force_login(self.admin)
        self.assertEqual(client.get("/api/v1/boxes/lookup", {"code": "BOX-000001"}).status_code, 404)
        response = client.post(
            f"/api/v1/boxes/{self.packed_box.public_id}/verifications",
            {"method": "RECORD_CHECK", "result": "MATCH"}, format="json",
        )
        self.assertEqual(response.status_code, 404)
