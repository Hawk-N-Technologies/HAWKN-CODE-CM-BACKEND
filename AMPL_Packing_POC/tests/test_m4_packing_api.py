"""
M4: the packing API exactly as the phone calls it.
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
    ConfigurationItem,
    PackingSection,
    ScanLog,
    SectionOperator,
)

PASSWORD = "a-long-test-password"


class PackingApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m4admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m4op", password=PASSWORD)
        cls.other_op = User.objects.create_user("m4other", password=PASSWORD)
        sku = Sku.objects.create(code="SKU001", name="Product One")
        cls.sku2 = Sku.objects.create(code="SKU002", name="Product Two")
        config = BoxConfiguration.objects.create(code="BC3", name="Three of SKU001")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=3)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        cls.section_b = PackingSection.objects.create(code="B", name="Section B", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        SectionOperator.objects.create(section=cls.section_b, user=cls.other_op)
        generate_uids(sku=sku, quantity=5, user=cls.admin)
        generate_uids(sku=cls.sku2, quantity=1, user=cls.admin)
        cls.uids = list(ProductUid.objects.filter(sku=sku).order_by("id").values_list("uid", flat=True))
        cls.wrong_sku_uid = ProductUid.objects.get(sku=cls.sku2).uid

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.operator)

    def start(self):
        return self.client.post(f"/api/v1/sections/{self.section.pk}/boxes")

    def scan(self, public_id, value, scan_id=""):
        return self.client.post(f"/api/v1/boxes/{public_id}/scans",
                                {"raw_value": value, "client_scan_id": scan_id}, format="json")

    def test_my_sections(self):
        data = self.client.get("/api/v1/my/sections").json()["data"]
        self.assertEqual([s["code"] for s in data], ["A"])
        self.assertEqual(data[0]["active_config"]["label"], "BC3 v1")
        self.assertEqual(data[0]["active_config"]["items"], [
            {"sku_code": "SKU001", "sku_name": "Product One", "quantity": 3}
        ])
        self.assertIsNone(data[0]["open_box"])
        public_id = self.start().json()["data"]["public_id"]
        data = self.client.get("/api/v1/my/sections").json()["data"]
        self.assertEqual(data[0]["open_box"]["public_id"], public_id)
        self.assertEqual(data[0]["open_box"]["total_expected"], 3)

    def test_start_returns_same_open_box(self):
        first = self.start()
        second = self.start()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["data"]["public_id"], second.json()["data"]["public_id"])
        self.assertEqual(first.json()["data"]["status"], "OPEN")

    def test_unassigned_section_blocked(self):
        response = self.client.post(f"/api/v1/sections/{self.section_b.pk}/boxes")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "SECTION_NOT_ASSIGNED")

    def test_other_operator_cannot_see_or_scan_my_box(self):
        public_id = self.start().json()["data"]["public_id"]
        other = APIClient()
        other.force_login(self.other_op)
        self.assertEqual(other.get(f"/api/v1/boxes/{public_id}").status_code, 403)
        response = other.post(f"/api/v1/boxes/{public_id}/scans", {"raw_value": self.uids[0]}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_unknown_box_404(self):
        response = self.client.get("/api/v1/boxes/00000000-0000-0000-0000-000000000000")
        self.assertEqual(response.status_code, 404)

    def test_full_flow_scan_complete(self):
        public_id = self.start().json()["data"]["public_id"]
        for index, uid in enumerate(self.uids[:3], start=1):
            response = self.scan(public_id, uid, scan_id=f"s{index}")
            self.assertEqual(response.status_code, 200, response.content)
            body = response.json()["data"]
            self.assertTrue(body["accepted"])
            self.assertEqual(body["progress"]["total_scanned"], index)
        self.assertTrue(body["progress"]["is_complete_ready"])

        detail = self.client.get(f"/api/v1/boxes/{public_id}").json()["data"]
        self.assertEqual([item["uid"] for item in detail["items"]], list(reversed(self.uids[:3])))

        done = self.client.post(f"/api/v1/boxes/{public_id}/complete")
        self.assertEqual(done.status_code, 200, done.content)
        data = done.json()["data"]
        self.assertEqual(data["box_uid"], "BOX-000001")
        self.assertEqual(data["status"], "COMPLETED")
        self.assertFalse(data["already_completed"])

        again = self.client.post(f"/api/v1/boxes/{public_id}/complete").json()["data"]
        self.assertEqual(again["box_uid"], "BOX-000001")
        self.assertTrue(again["already_completed"])

        next_box = self.start()
        self.assertEqual(next_box.status_code, 201)
        self.assertNotEqual(next_box.json()["data"]["public_id"], public_id)

    def test_rejections_return_code_and_are_logged(self):
        public_id = self.start().json()["data"]["public_id"]
        self.scan(public_id, self.uids[0])
        cases = [
            ("abc", 422, "INVALID_FORMAT"),
            ("BOX-000001", 422, "IS_BOX_LABEL"),
            (self.uids[0], 409, "ALREADY_IN_THIS_BOX"),
            (self.wrong_sku_uid, 422, "SKU_NOT_IN_CONFIG"),
        ]
        for value, http_status, code in cases:
            with self.subTest(code=code):
                response = self.scan(public_id, value)
                self.assertEqual(response.status_code, http_status)
                body = response.json()
                self.assertFalse(body["success"])
                self.assertEqual(body["code"], code)
                self.assertTrue(body["message"])
        self.assertEqual(
            ScanLog.objects.filter(box__public_id=public_id, accepted=False).count(), len(cases)
        )

    def test_excess_quantity_and_incomplete_completion(self):
        public_id = self.start().json()["data"]["public_id"]
        self.scan(public_id, self.uids[0])
        early = self.client.post(f"/api/v1/boxes/{public_id}/complete")
        self.assertEqual(early.status_code, 409)
        self.assertEqual(early.json()["code"], "COUNTS_INCOMPLETE")
        for uid in self.uids[1:3]:
            self.scan(public_id, uid)
        full = self.scan(public_id, self.uids[3])
        self.assertEqual(full.status_code, 409)
        self.assertEqual(full.json()["code"], "SKU_QUANTITY_FULL")

    def test_network_retry(self):
        public_id = self.start().json()["data"]["public_id"]
        self.scan(public_id, self.uids[0], scan_id="same-id")
        retry = self.scan(public_id, self.uids[0], scan_id="same-id")
        self.assertEqual(retry.status_code, 200)
        self.assertTrue(retry.json()["data"]["duplicate_request"])

    def test_remove_item(self):
        public_id = self.start().json()["data"]["public_id"]
        self.scan(public_id, self.uids[0])
        response = self.client.delete(f"/api/v1/boxes/{public_id}/items/{self.uids[0]}",
                                      {"reason": "wrong carton"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["data"]["progress"]["total_scanned"], 0)
        missing = self.client.delete(f"/api/v1/boxes/{public_id}/items/{self.uids[0]}")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json()["code"], "ITEM_NOT_IN_BOX")

    def test_cancel(self):
        public_id = self.start().json()["data"]["public_id"]
        self.scan(public_id, self.uids[0])
        no_reason = self.client.post(f"/api/v1/boxes/{public_id}/cancel", {}, format="json")
        self.assertEqual(no_reason.status_code, 422)
        response = self.client.post(f"/api/v1/boxes/{public_id}/cancel", {"reason": "carton torn"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "CANCELLED")
        self.assertEqual(ProductUid.objects.get(uid=self.uids[0]).status, ProductUid.Status.AVAILABLE)
        self.assertEqual(Box.objects.filter(status=Box.Status.OPEN).count(), 0)

    def test_admin_can_pack_any_section(self):
        admin = APIClient()
        admin.force_login(self.admin)
        sections = admin.get("/api/v1/my/sections").json()["data"]
        self.assertEqual([s["code"] for s in sections], ["A", "B"])
        self.assertEqual(admin.post(f"/api/v1/sections/{self.section_b.pk}/boxes").status_code, 201)

    def test_anonymous_401(self):
        self.assertEqual(APIClient().get("/api/v1/my/sections").status_code, 401)
