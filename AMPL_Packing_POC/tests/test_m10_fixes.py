"""
M10: regression tests for the defects fixed in the bug-fixing round.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.common.exceptions import AppError
from apps.packing.models import (
    BoxConfiguration,
    BoxConfigurationVersion,
    BoxItem,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)
from apps.packing.services.box_service import remove_item, scan_product, start_box

PASSWORD = "a-long-test-password"


class M10Fixture(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m10admin", password=PASSWORD, role="ADMIN")
        cls.operator = User.objects.create_user("m10op", password=PASSWORD)
        sku = Sku.objects.create(code="SKU001", name="Product One")
        cls.config = BoxConfiguration.objects.create(code="BC2", name="Two")
        version = BoxConfigurationVersion.objects.create(configuration=cls.config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=3)
        cls.section = PackingSection.objects.create(code="A", name="Section A", active_config_version=version)
        SectionOperator.objects.create(section=cls.section, user=cls.operator)
        generate_uids(sku=sku, quantity=3, user=cls.admin)
        cls.uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))


class RetryAfterRemovalTests(M10Fixture):
    def test_retry_of_removed_item_adds_it_again(self):
        box, _ = start_box(section=self.section, user=self.operator)
        scan_product(box=box, raw_value=self.uids[0], user=self.operator, client_scan_id="same")
        remove_item(box=box, uid=self.uids[0], user=self.operator, reason="wrong")
        result = scan_product(box=box, raw_value=self.uids[0], user=self.operator, client_scan_id="same")
        self.assertFalse(result["duplicate_request"])
        self.assertTrue(BoxItem.objects.filter(box=box, product_uid__uid=self.uids[0]).exists())
        self.assertEqual(result["progress"]["total_scanned"], 1)

    def test_reused_scan_id_with_other_value_is_checked_normally(self):
        box, _ = start_box(section=self.section, user=self.operator)
        scan_product(box=box, raw_value=self.uids[0], user=self.operator, client_scan_id="same")
        with self.assertRaises(AppError) as ctx:
            scan_product(box=box, raw_value="999999", user=self.operator, client_scan_id="same")
        self.assertEqual(ctx.exception.error_code, "UID_NOT_FOUND")
        second = scan_product(box=box, raw_value=self.uids[1], user=self.operator, client_scan_id="same")
        self.assertFalse(second["duplicate_request"])
        self.assertEqual(second["progress"]["total_scanned"], 2)


class InactiveConfigurationTests(M10Fixture):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.admin)

    def test_cannot_start_box_with_inactive_configuration(self):
        self.config.is_active = False
        self.config.save()
        with self.assertRaises(AppError) as ctx:
            start_box(section=self.section, user=self.operator)
        self.assertEqual(ctx.exception.error_code, "CONFIG_INACTIVE")

    def test_cannot_reactivate_section_whose_configuration_is_inactive(self):
        self.assertEqual(
            self.client.patch(f"/api/v1/sections/{self.section.pk}", {"is_active": False}, format="json").status_code, 200
        )
        self.assertEqual(
            self.client.patch(f"/api/v1/box-configurations/{self.config.pk}", {"is_active": False}, format="json").status_code, 200
        )
        response = self.client.patch(f"/api/v1/sections/{self.section.pk}", {"is_active": True}, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "INVALID_CONFIGURATION")
        self.assertFalse(PackingSection.objects.get(pk=self.section.pk).is_active)

    def test_reactivate_with_new_active_configuration_in_same_request(self):
        self.client.patch(f"/api/v1/sections/{self.section.pk}", {"is_active": False}, format="json")
        self.client.patch(f"/api/v1/box-configurations/{self.config.pk}", {"is_active": False}, format="json")
        other = BoxConfiguration.objects.create(code="BC9", name="Nine")
        version = BoxConfigurationVersion.objects.create(configuration=other, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=Sku.objects.get(code="SKU001"), quantity=1)
        response = self.client.patch(
            f"/api/v1/sections/{self.section.pk}",
            {"is_active": True, "active_config_version_id": version.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["data"]["is_active"])
        self.assertEqual(response.json()["data"]["active_config"]["label"], "BC9 v1")
