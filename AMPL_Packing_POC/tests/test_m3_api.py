"""
M3: login API and the SKU / UID API, called exactly as the browser will.
"""
import csv
import io
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services import uid_generation
from apps.packing.models import (
    BoxConfiguration,
    BoxConfigurationVersion,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)

PASSWORD = "a-long-test-password"


class ApiFixture(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m3admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m3op", password=PASSWORD, first_name="Asha")
        cls.inactive = User.objects.create_user("m3gone", password=PASSWORD, is_active=False)
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC2", name="Box config 2")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=25)
        cls.section_a = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        cls.section_b = PackingSection.objects.create(code="B", name="Section B")
        SectionOperator.objects.create(section=cls.section_a, user=cls.operator)
        cls.sku = sku

    def setUp(self):
        cache.clear()  # resets the login rate limit between tests
        self.client = APIClient()

    def as_admin(self):
        self.client.force_login(self.admin)
        return self.client

    def as_operator(self):
        self.client.force_login(self.operator)
        return self.client

    def generate(self, quantity=25):
        return self.as_admin().post(f"/api/v1/skus/{self.sku.pk}/uid-batches",
                                    {"quantity": quantity}, format="json")


# ---------------------------------------------------------------------------
class AuthApiTests(ApiFixture):
    def test_csrf_endpoint_sets_cookie(self):
        response = self.client.get("/api/v1/auth/csrf")
        self.assertEqual(response.status_code, 200)
        self.assertIn("ampl_csrftoken", response.cookies)

    def test_login_with_csrf_token_like_the_browser(self):
        browser = APIClient(enforce_csrf_checks=True)
        token = browser.get("/api/v1/auth/csrf").cookies["ampl_csrftoken"].value
        response = browser.post("/api/v1/auth/login", {"username": "m3op", "password": PASSWORD},
                                format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual(data["role"], "OPERATOR")
        self.assertEqual(data["display_name"], "Asha")
        self.assertEqual([s["code"] for s in data["sections"]], ["A"])
        self.assertEqual(data["sections"][0]["active_config"], "BC2 v1")
        self.assertIn("ampl_sessionid", response.cookies)

    def test_login_without_csrf_token_is_refused(self):
        browser = APIClient(enforce_csrf_checks=True)
        response = browser.post("/api/v1/auth/login", {"username": "m3op", "password": PASSWORD},
                                format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "PERMISSION_DENIED")

    def test_wrong_password(self):
        response = self.client.post("/api/v1/auth/login", {"username": "m3op", "password": "nope"},
                                    format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "INVALID_CREDENTIALS")

    def test_inactive_user_cannot_login(self):
        response = self.client.post("/api/v1/auth/login", {"username": "m3gone", "password": PASSWORD},
                                    format="json")
        self.assertEqual(response.json()["code"], "INVALID_CREDENTIALS")

    def test_missing_fields(self):
        response = self.client.post("/api/v1/auth/login", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "VALIDATION_ERROR")

    def test_login_rate_limited(self):
        for _ in range(10):
            self.client.post("/api/v1/auth/login", {"username": "x", "password": "y"}, format="json")
        response = self.client.post("/api/v1/auth/login", {"username": "x", "password": "y"}, format="json")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "TOO_MANY_REQUESTS")

    def test_me_requires_login(self):
        response = self.client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "NOT_AUTHENTICATED")

    def test_admin_sees_all_active_sections(self):
        data = self.as_admin().get("/api/v1/auth/me").json()["data"]
        self.assertEqual(data["role"], "ADMIN")
        self.assertEqual([s["code"] for s in data["sections"]], ["A", "B"])

    def test_logout(self):
        client = self.as_operator()
        self.assertEqual(client.post("/api/v1/auth/logout").status_code, 200)
        self.assertEqual(client.get("/api/v1/auth/me").status_code, 401)


# ---------------------------------------------------------------------------
class PermissionTests(ApiFixture):
    def test_operator_blocked_from_admin_endpoints(self):
        client = self.as_operator()
        for url in ("/api/v1/skus", "/api/v1/uid-batches", "/api/v1/product-uids",
                    "/api/v1/uid-capacity", f"/api/v1/skus/{self.sku.pk}"):
            with self.subTest(url=url):
                response = client.get(url)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "PERMISSION_DENIED")
        response = client.post(f"/api/v1/skus/{self.sku.pk}/uid-batches", {"quantity": 5}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(ProductUid.objects.count(), 0)

    def test_anonymous_gets_401(self):
        self.assertEqual(self.client.get("/api/v1/skus").status_code, 401)


# ---------------------------------------------------------------------------
class SkuApiTests(ApiFixture):
    def test_create_normalises_code(self):
        response = self.as_admin().post("/api/v1/skus", {"code": " sku002 ", "name": "Product Two"},
                                        format="json")
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()["data"]
        self.assertEqual(body["code"], "SKU002")
        self.assertEqual(body["counts"]["total"], 0)
        self.assertEqual(Sku.objects.get(code="SKU002").created_by, self.admin)

    def test_duplicate_code_case_insensitive(self):
        response = self.as_admin().post("/api/v1/skus", {"code": "Sku001", "name": "Dup"}, format="json")
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(body["code"], "VALIDATION_ERROR")
        self.assertEqual(body["errors"][0]["field"], "code")

    def test_invalid_code_format(self):
        response = self.as_admin().post("/api/v1/skus", {"code": "SKU 01!", "name": "Bad"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_code_cannot_change_but_name_can(self):
        client = self.as_admin()
        url = f"/api/v1/skus/{self.sku.pk}"
        self.assertEqual(client.patch(url, {"code": "SKU999"}, format="json").status_code, 400)
        response = client.patch(url, {"name": "Renamed", "is_active": False}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["name"], "Renamed")
        self.assertFalse(response.json()["data"]["is_active"])

    def test_list_search_and_counts(self):
        self.generate(5)
        response = self.as_admin().get("/api/v1/skus?q=sku0")
        body = response.json()
        self.assertEqual(body["pagination"]["total_items"], 1)
        self.assertEqual(body["data"][0]["counts"], {"total": 5, "available": 5, "in_box": 0,
                                                     "packed": 0, "void": 0})


# ---------------------------------------------------------------------------
class UidApiTests(ApiFixture):
    def test_generate_25(self):
        response = self.generate(25)
        self.assertEqual(response.status_code, 201, response.content)
        uids = [row["uid"] for row in response.json()["data"]["uids"]]
        self.assertEqual(len(uids), 25)
        self.assertEqual(len(set(uids)), 25)
        self.assertEqual(ProductUid.objects.filter(sku=self.sku).count(), 25)

    def test_invalid_quantity(self):
        for bad in (0, 10001, "x", None):
            with self.subTest(quantity=bad):
                response = self.generate(bad)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["code"], "INVALID_QUANTITY")

    def test_capacity_guard(self):
        with mock.patch.object(uid_generation, "remaining_capacity", return_value=3):
            response = self.generate(4)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "CAPACITY_EXCEEDED")

    def test_unknown_sku(self):
        response = self.as_admin().post("/api/v1/skus/99999/uid-batches", {"quantity": 1}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "NOT_FOUND")

    def test_batch_list_detail_and_csv(self):
        batch_id = self.generate(25).json()["data"]["id"]
        client = self.as_admin()
        listing = client.get(f"/api/v1/uid-batches?sku={self.sku.pk}").json()
        self.assertEqual(listing["data"][0]["id"], batch_id)
        detail = client.get(f"/api/v1/uid-batches/{batch_id}").json()["data"]
        self.assertEqual(len(detail["uids"]), 25)

        response = client.get(f"/api/v1/uid-batches/{batch_id}/export.csv")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment;", response["Content-Disposition"])
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(rows[0], ["uid", "sku_code", "sku_name", "status", "batch_id", "created_at"])
        self.assertEqual(len(rows), 26)
        self.assertEqual({row[0] for row in rows[1:]}, {u["uid"] for u in detail["uids"]})

    def test_csv_is_admin_only(self):
        batch_id = self.generate(1).json()["data"]["id"]
        anonymous = APIClient()
        self.assertEqual(anonymous.get(f"/api/v1/uid-batches/{batch_id}/export.csv").status_code, 401)
        self.client.logout()
        self.assertEqual(self.as_operator().get(f"/api/v1/uid-batches/{batch_id}/export.csv").status_code, 403)

    def test_product_uid_list_detail_and_void(self):
        uids = [row["uid"] for row in self.generate(3).json()["data"]["uids"]]
        client = self.as_admin()
        listing = client.get("/api/v1/product-uids?status=available").json()
        self.assertEqual(listing["pagination"]["total_items"], 3)

        detail = client.get(f"/api/v1/product-uids/{uids[0]}").json()["data"]
        self.assertEqual(detail["sku_code"], "SKU001")
        self.assertIsNone(detail["box_uid"])
        self.assertEqual(detail["history"], [])

        response = client.post(f"/api/v1/product-uids/{uids[0]}/void", {"reason": "Torn label"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "VOID")
        again = client.post(f"/api/v1/product-uids/{uids[0]}/void", {"reason": "x"}, format="json")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.json()["code"], "UID_NOT_VOIDABLE")
        no_reason = client.post(f"/api/v1/product-uids/{uids[1]}/void", {}, format="json")
        self.assertEqual(no_reason.json()["code"], "REASON_REQUIRED")
        self.assertEqual(client.get("/api/v1/product-uids/999999").status_code, 404)

    def test_capacity_endpoint(self):
        self.generate(4)
        data = self.as_admin().get("/api/v1/uid-capacity").json()["data"]
        self.assertEqual(data, {"total": 900000, "used": 4, "remaining": 899996})
