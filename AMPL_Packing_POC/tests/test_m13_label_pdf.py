"""
M13: box label as a PDF page of exactly 100 x 50 mm.
"""
import re

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.labels.pdf import MM, box_label_pdf, fit
from apps.labels.qr import qr_matrix
from apps.packing.models import (
    BoxConfiguration,
    BoxConfigurationVersion,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)
from apps.packing.services.box_service import complete_box, scan_product, start_box

PASSWORD = "a-long-test-password"


def media_box_mm(pdf: bytes):
    match = re.search(rb"/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]", pdf)
    return round(float(match.group(1)) / MM, 2), round(float(match.group(2)) / MM, 2)


class LabelPdfBuilderTests(SimpleTestCase):
    def build(self, **overrides):
        values = {
            "matrix": qr_matrix("BOX-000007"),
            "box_uid": "BOX-000007",
            "config_label": "BC2 v1",
            "total_items": 25,
            "section_code": "A",
            "date_text": "16/11/2026",
        }
        values.update(overrides)
        return box_label_pdf(**values)

    def test_page_is_exactly_100_by_50_mm(self):
        pdf = self.build()
        self.assertTrue(pdf.startswith(b"%PDF-1.7"))
        self.assertTrue(pdf.rstrip().endswith(b"%%EOF"))
        self.assertEqual(media_box_mm(pdf), (100.0, 50.0))
        self.assertEqual(pdf.count(b"/Type /Page "), 1)  # one label per page
        self.assertIn(b"/PrintScaling /None", pdf)

    def test_label_text(self):
        pdf = self.build()
        for text in (b"(BOX ID)", b"(BOX-000007)", b"(BC2 v1)", b"(25 pcs)", b"(Section A)", b"(16/11/2026)"):
            self.assertIn(text, pdf)

    def test_cross_reference_offsets_are_correct(self):
        pdf = self.build()
        xref_at = int(re.search(rb"startxref\n(\d+)", pdf).group(1))
        self.assertTrue(pdf[xref_at:].startswith(b"xref"))
        offsets = [int(x) for x in re.findall(rb"(\d{10}) 00000 n ", pdf)]
        for number, offset in enumerate(offsets, start=1):
            self.assertTrue(pdf[offset:].startswith(f"{number} 0 obj".encode()))

    def test_long_text_is_shortened_and_special_characters_are_safe(self):
        long_name = fit("BC9 v12 a very long box configuration name for testing", 11, "F1", 47 * MM)
        self.assertTrue(long_name.endswith("..."))
        self.assertLess(len(long_name), 50)
        pdf = self.build(config_label="Mix (A) \\ B × C")
        self.assertIn(b"(Mix \\(A\\) \\\\ B ? C)", pdf)


class LabelPdfEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m13admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m13op", password=PASSWORD)
        cls.outsider = User.objects.create_user("m13out", password=PASSWORD)
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC2", name="Two")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=2)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        generate_uids(sku=sku, quantity=2, user=cls.admin)
        cls.uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))

    def client_for(self, user=None):
        client = APIClient()
        if user:
            client.force_login(user)
        return client

    def test_pdf_for_completed_box(self):
        box, _ = start_box(section=self.section, user=self.operator)
        for uid in self.uids:
            scan_product(box=box, raw_value=uid, user=self.operator)
        box = complete_box(box=box, user=self.operator)["box"]

        response = self.client_for(self.operator).get(f"/api/v1/boxes/{box.public_id}/label.pdf")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn('filename="BOX-000001.pdf"', response["Content-Disposition"])
        self.assertEqual(media_box_mm(response.content), (100.0, 50.0))
        for text in (b"(BOX-000001)", b"(BC2 v1)", b"(2 pcs)", b"(Section A)"):
            self.assertIn(text, response.content)

        self.assertEqual(self.client_for(self.outsider).get(f"/api/v1/boxes/{box.public_id}/label.pdf").status_code, 403)
        self.assertEqual(self.client_for().get(f"/api/v1/boxes/{box.public_id}/label.pdf").status_code, 401)

    def test_open_box_has_no_pdf(self):
        box, _ = start_box(section=self.section, user=self.operator)
        response = self.client_for(self.operator).get(f"/api/v1/boxes/{box.public_id}/label.pdf")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "BOX_NOT_COMPLETED")
