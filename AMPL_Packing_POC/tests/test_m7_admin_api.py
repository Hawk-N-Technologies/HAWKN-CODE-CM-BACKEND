"""
M7: admin API for box configurations, sections, operators and users.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.packing.models import Box, BoxConfiguration, PackingSection, SectionOperator
from apps.packing.services.box_service import scan_product, start_box

PASSWORD = "a-long-test-password"


class AdminApiFixture(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m7admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m7op", password=PASSWORD)
        cls.sku1 = Sku.objects.create(code="SKU001", name="Product One")
        cls.sku2 = Sku.objects.create(code="SKU002", name="Product Two")
        cls.old_sku = Sku.objects.create(code="OLD", name="Retired", is_active=False)

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.admin)

    def create_config(self, code="BC1", items=None):
        items = items or [{"sku_id": self.sku1.pk, "quantity": 10}, {"sku_id": self.sku2.pk, "quantity": 30}]
        return self.client.post("/api/v1/box-configurations",
                                {"code": code, "name": f"Config {code}", "items": items}, format="json")

    def latest_version_id(self, config_payload):
        return config_payload["versions"][0]["id"]


class ConfigurationApiTests(AdminApiFixture):
    def test_create_list_and_lowercase_code(self):
        response = self.create_config(code="bc1")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()["data"]
        self.assertEqual(data["code"], "BC1")
        version = data["versions"][0]
        self.assertEqual(version["version_no"], 1)
        self.assertEqual(version["label"], "BC1 v1")
        self.assertEqual(version["total_quantity"], 40)
        self.assertEqual([item["sku_code"] for item in version["items"]], ["SKU001", "SKU002"])
        listing = self.client.get("/api/v1/box-configurations").json()["data"]
        self.assertEqual([config["code"] for config in listing], ["BC1"])

    def test_item_validation(self):
        cases = {
            "empty": [],
            "duplicate": [{"sku_id": self.sku1.pk, "quantity": 1}, {"sku_id": self.sku1.pk, "quantity": 2}],
            "inactive": [{"sku_id": self.old_sku.pk, "quantity": 1}],
            "unknown": [{"sku_id": 99999, "quantity": 1}],
            "zero": [{"sku_id": self.sku1.pk, "quantity": 0}],
            "too_many": [{"sku_id": self.sku1.pk, "quantity": 10001}],
        }
        for name, items in cases.items():
            with self.subTest(case=name):
                response = self.client.post("/api/v1/box-configurations",
                                            {"code": f"X{name}", "name": "x", "items": items}, format="json")
                self.assertEqual(response.status_code, 400, response.content)
                self.assertEqual(response.json()["code"], "VALIDATION_ERROR")
        self.assertEqual(BoxConfiguration.objects.count(), 0)

    def test_duplicate_code(self):
        self.create_config(code="BC1")
        self.assertEqual(self.create_config(code="Bc1").status_code, 400)

    def test_new_version_applies_to_sections_and_keeps_open_box(self):
        config = self.create_config().json()["data"]
        v1 = self.latest_version_id(config)
        section = self.client.post("/api/v1/sections",
                                   {"code": "A", "name": "Section A", "active_config_version_id": v1},
                                   format="json").json()["data"]
        SectionOperator.objects.create(section_id=section["id"], user=self.operator)
        open_box, _ = start_box(section=PackingSection.objects.get(pk=section["id"]), user=self.operator)

        response = self.client.post(f"/api/v1/box-configurations/{config['id']}/versions",
                                    {"items": [{"sku_id": self.sku1.pk, "quantity": 25}]}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()["data"]
        self.assertEqual(data["sections_switched"], 1)
        self.assertEqual(data["versions"][0]["version_no"], 2)
        self.assertEqual(data["versions"][1]["box_count"], 1)  # v1 is used by the open box
        self.assertEqual(PackingSection.objects.get(pk=section["id"]).active_config_version.version_no, 2)
        open_box.refresh_from_db()
        self.assertEqual(open_box.config_version_id, v1)

    def test_same_items_is_rejected(self):
        config = self.create_config().json()["data"]
        items = [{"sku_id": item["sku_id"], "quantity": item["quantity"]} for item in config["versions"][0]["items"]]
        response = self.client.post(f"/api/v1/box-configurations/{config['id']}/versions", {"items": items}, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "NO_CHANGES")

    def test_cannot_deactivate_config_in_use(self):
        config = self.create_config().json()["data"]
        self.client.post("/api/v1/sections", {"code": "A", "name": "A",
                                              "active_config_version_id": self.latest_version_id(config)}, format="json")
        response = self.client.patch(f"/api/v1/box-configurations/{config['id']}", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "CONFIG_IN_USE")
        renamed = self.client.patch(f"/api/v1/box-configurations/{config['id']}", {"name": "Renamed"}, format="json")
        self.assertEqual(renamed.json()["data"]["name"], "Renamed")


class SectionApiTests(AdminApiFixture):
    def test_create_assign_config_and_operators(self):
        config = self.create_config().json()["data"]
        response = self.client.post("/api/v1/sections", {"code": "a", "name": "Section A"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        section = response.json()["data"]
        self.assertEqual(section["code"], "A")
        self.assertIsNone(section["active_config"])

        updated = self.client.patch(f"/api/v1/sections/{section['id']}",
                                    {"active_config_version_id": self.latest_version_id(config)}, format="json")
        self.assertEqual(updated.json()["data"]["active_config"]["label"], "BC1 v1")

        added = self.client.post(f"/api/v1/sections/{section['id']}/operators", {"user_id": self.operator.pk}, format="json")
        self.assertEqual(added.status_code, 201)
        self.assertEqual([op["username"] for op in added.json()["data"]["operators"]], ["m7op"])
        again = self.client.post(f"/api/v1/sections/{section['id']}/operators", {"user_id": self.operator.pk}, format="json")
        self.assertEqual(again.status_code, 200)

        admin_as_operator = self.client.post(f"/api/v1/sections/{section['id']}/operators",
                                             {"user_id": self.admin.pk}, format="json")
        self.assertEqual(admin_as_operator.json()["code"], "NOT_AN_OPERATOR")

        removed = self.client.delete(f"/api/v1/sections/{section['id']}/operators/{self.operator.pk}")
        self.assertEqual(removed.json()["data"]["operators"], [])
        self.assertEqual(self.client.delete(f"/api/v1/sections/{section['id']}/operators/{self.operator.pk}").status_code, 404)

    def test_invalid_configuration_for_section(self):
        response = self.client.post("/api/v1/sections", {"code": "B", "name": "B", "active_config_version_id": 99999},
                                    format="json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "INVALID_CONFIGURATION")

    def test_cannot_deactivate_section_with_open_box(self):
        config = self.create_config(items=[{"sku_id": self.sku1.pk, "quantity": 2}]).json()["data"]
        section = self.client.post("/api/v1/sections", {"code": "A", "name": "A",
                                                        "active_config_version_id": self.latest_version_id(config)},
                                   format="json").json()["data"]
        box, _ = start_box(section=PackingSection.objects.get(pk=section["id"]), user=self.admin)
        generate_uids(sku=self.sku1, quantity=1, user=self.admin)
        scan_product(box=box, raw_value=ProductUid.objects.first().uid, user=self.admin)
        response = self.client.patch(f"/api/v1/sections/{section['id']}", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "SECTION_HAS_OPEN_BOX")
        self.assertTrue(PackingSection.objects.get(pk=section["id"]).is_active)
        self.assertEqual(Box.objects.filter(status="OPEN").count(), 1)


class UserApiTests(AdminApiFixture):
    def test_create_operator_and_login(self):
        response = self.client.post("/api/v1/users", {"username": "packer2", "password": "Pack-Line-2026!",
                                                      "role": "OPERATOR", "first_name": "Meera"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()["data"]
        self.assertEqual(data["role"], "OPERATOR")
        self.assertEqual(data["display_name"], "Meera")
        user = User.objects.get(username="packer2")
        self.assertFalse(user.is_staff)
        self.assertTrue(user.check_password("Pack-Line-2026!"))

    def test_create_admin_gets_admin_console_access(self):
        self.client.post("/api/v1/users", {"username": "boss2", "password": "Strong-Admin-2026!", "role": "ADMIN"},
                         format="json")
        user = User.objects.get(username="boss2")
        self.assertTrue(user.is_staff and user.is_superuser and user.is_ampl_admin)

    def test_create_validation(self):
        weak = self.client.post("/api/v1/users", {"username": "weakling", "password": "123", "role": "OPERATOR"}, format="json")
        self.assertEqual(weak.status_code, 400)
        self.assertEqual(weak.json()["errors"][0]["field"], "password")
        taken = self.client.post("/api/v1/users", {"username": "M7OP", "password": "Pack-Line-2026!", "role": "OPERATOR"},
                                 format="json")
        self.assertEqual(taken.json()["errors"][0]["field"], "username")

    def test_update_reset_password_and_deactivate(self):
        response = self.client.patch(f"/api/v1/users/{self.operator.pk}",
                                     {"password": "New-Pass-2026!", "is_active": False}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.operator.refresh_from_db()
        self.assertTrue(self.operator.check_password("New-Pass-2026!"))
        self.assertFalse(self.operator.is_active)

    def test_admin_cannot_lock_themselves_out(self):
        for payload in ({"is_active": False}, {"role": "OPERATOR"}):
            with self.subTest(payload=payload):
                response = self.client.patch(f"/api/v1/users/{self.admin.pk}", payload, format="json")
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["code"], "CANNOT_CHANGE_SELF")

    def test_list_filter_and_operator_blocked(self):
        operators = self.client.get("/api/v1/users?role=operator").json()["data"]
        self.assertEqual([user["username"] for user in operators], ["m7op"])
        blocked = APIClient()
        blocked.force_login(self.operator)
        for url in ("/api/v1/users", "/api/v1/sections", "/api/v1/box-configurations"):
            with self.subTest(url=url):
                self.assertEqual(blocked.get(url).status_code, 403)
