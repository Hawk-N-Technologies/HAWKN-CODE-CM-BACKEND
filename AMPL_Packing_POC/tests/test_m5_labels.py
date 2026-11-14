"""
M5: QR label generation and the label endpoints.
"""
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.labels.qr import qr_svg
from apps.labels.svg import matrix_to_svg
from apps.packing.models import (
    BoxConfiguration,
    BoxConfigurationVersion,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)
from apps.packing.services.box_service import complete_box, scan_product, start_box

PASSWORD = "a-long-test-password"


class QrSvgTests(SimpleTestCase):
    def test_matrix_to_svg_draws_dark_runs(self):
        svg = matrix_to_svg([[True, True, False], [False, True, False], [True, False, True]], "x")
        self.assertIn('viewBox="0 0 3 3"', svg)
        self.assertIn("M0 0h2v1h-2z", svg)
        self.assertIn("M2 2h1v1h-1z", svg)

    def test_product_and_box_ids_fit_version_one(self):
        # 21 modules + 2 x 4 quiet zone = 29
        for value in ("483921", "999999", "BOX-000001"):
            with self.subTest(value=value):
                svg = qr_svg(value)
                self.assertTrue(svg.startswith("<svg"))
                self.assertIn('viewBox="0 0 29 29"', svg)
                self.assertIn(f'aria-label="{value}"', svg)

    def test_same_input_same_output(self):
        self.assertEqual(qr_svg("483921"), qr_svg("483921"))
        self.assertNotEqual(qr_svg("483921"), qr_svg("483922"))


class LabelEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m5admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m5op", password=PASSWORD)
        cls.outsider = User.objects.create_user("m5out", password=PASSWORD)
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC2", name="Two")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=2)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        cls.batch = generate_uids(sku=sku, quantity=3, user=cls.admin)
        cls.uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))

    def client_for(self, user=None):
        client = APIClient()
        if user:
            client.force_login(user)
        return client

    def completed_box(self):
        box, _ = start_box(section=self.section, user=self.operator)
        for uid in self.uids[:2]:
            scan_product(box=box, raw_value=uid, user=self.operator)
        return complete_box(box=box, user=self.operator)["box"]

    def test_product_qr_svg(self):
        response = self.client_for(self.admin).get(f"/api/v1/product-uids/{self.uids[0]}/qr.svg")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("image/svg+xml"))
        self.assertIn(b'viewBox="0 0 29 29"', response.content)

    def test_product_qr_access(self):
        url = f"/api/v1/product-uids/{self.uids[0]}/qr.svg"
        self.assertEqual(self.client_for().get(url).status_code, 401)
        self.assertEqual(self.client_for(self.operator).get(url).status_code, 403)
        self.assertEqual(self.client_for(self.admin).get("/api/v1/product-uids/999999/qr.svg").status_code, 404)

    def test_batch_labels(self):
        response = self.client_for(self.admin).get(f"/api/v1/uid-batches/{self.batch.pk}/labels")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual(data["batch"]["sku_code"], "SKU001")
        self.assertEqual(data["total_labels"], 3)
        self.assertEqual(data["total_pages"], 1)
        self.assertEqual([label["uid"] for label in data["labels"]], self.uids)
        self.assertTrue(all(label["svg"].startswith("<svg") for label in data["labels"]))
        self.assertEqual(self.client_for(self.operator).get(f"/api/v1/uid-batches/{self.batch.pk}/labels").status_code, 403)

    def test_box_label_only_for_completed_box(self):
        box, _ = start_box(section=self.section, user=self.operator)
        client = self.client_for(self.operator)
        response = client.get(f"/api/v1/boxes/{box.public_id}/label")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "BOX_NOT_COMPLETED")

    def test_box_label_and_svg(self):
        box = self.completed_box()
        client = self.client_for(self.operator)
        data = client.get(f"/api/v1/boxes/{box.public_id}/label").json()["data"]
        self.assertEqual(data["box_uid"], "BOX-000001")
        self.assertEqual(data["total_items"], 2)
        self.assertEqual(data["config_label"], "BC2 v1")
        self.assertIn('aria-label="BOX-000001"', data["svg"])

        svg = client.get("/api/v1/boxes/BOX-000001/qr.svg")
        self.assertEqual(svg.status_code, 200)
        self.assertTrue(svg["Content-Type"].startswith("image/svg+xml"))

    def test_box_label_access(self):
        box = self.completed_box()
        outsider = self.client_for(self.outsider)
        self.assertEqual(outsider.get(f"/api/v1/boxes/{box.public_id}/label").status_code, 403)
        self.assertEqual(outsider.get("/api/v1/boxes/BOX-000001/qr.svg").status_code, 403)
        self.assertEqual(self.client_for(self.admin).get("/api/v1/boxes/BOX-000001/qr.svg").status_code, 200)
        self.assertEqual(self.client_for(self.admin).get("/api/v1/boxes/BOX-999999/qr.svg").status_code, 404)
