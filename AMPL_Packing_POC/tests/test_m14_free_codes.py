"""
M14: SKU, box configuration and section codes have no naming rule.
Any characters are allowed; a code still cannot be empty, longer than 32
characters, or a duplicate.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Sku
from apps.packing.models import BoxConfiguration, PackingSection

PASSWORD = "a-long-test-password"


class FreeCodeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m14admin", password=PASSWORD, role="ADMIN")
        cls.sku = Sku.objects.create(code="SKU001", name="Product One")

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.admin)

    def test_sku_code_with_symbols(self):
        response = self.client.post("/api/v1/skus", {"code": "(W/0)T0021", "name": "Roller 21"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["code"], "(W/0)T0021")
        self.assertTrue(Sku.objects.filter(code="(W/0)T0021").exists())

    def test_box_configuration_code_with_symbols(self):
        response = self.client.post(
            "/api/v1/box-configurations",
            {"code": "{BC}[2]!_x", "name": "Box", "items": [{"sku_id": self.sku.pk, "quantity": 5}]},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()["data"]
        self.assertEqual(data["code"], "{BC}[2]!_X")
        self.assertEqual(data["versions"][0]["label"], "{BC}[2]!_X v1")

    def test_section_code_with_symbols(self):
        response = self.client.post("/api/v1/sections", {"code": "Line #1/A", "name": "Line 1"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["code"], "LINE #1/A")

    def test_django_admin_path_accepts_symbols(self):
        # The Django admin runs full_clean() and then saves; the database no longer refuses these codes.
        for obj in (
            Sku(code="@sku/9", name="At sign"),
            BoxConfiguration(code="(bc)-9", name="Brackets"),
            PackingSection(code="#b!", name="Hash"),
        ):
            with self.subTest(code=obj.code):
                obj.full_clean()
                obj.save()
                obj.refresh_from_db()
        self.assertTrue(Sku.objects.filter(code="@SKU/9").exists())
        self.assertTrue(BoxConfiguration.objects.filter(code="(BC)-9").exists())
        self.assertTrue(PackingSection.objects.filter(code="#B!").exists())

    def test_empty_too_long_and_duplicate_still_refused(self):
        cases = [
            ("/api/v1/skus", {"code": "   ", "name": "Blank"}),
            ("/api/v1/skus", {"code": "X" * 33, "name": "Too long"}),
            ("/api/v1/skus", {"code": "sku001", "name": "Duplicate"}),
            ("/api/v1/sections", {"code": "", "name": "Blank"}),
        ]
        for url, payload in cases:
            with self.subTest(payload=payload):
                response = self.client.post(url, payload, format="json")
                self.assertEqual(response.status_code, 400, response.content)
                self.assertEqual(response.json()["code"], "VALIDATION_ERROR")
