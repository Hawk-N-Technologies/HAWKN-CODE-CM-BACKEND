"""
M1: prove the database itself rejects invalid data, independent of app code.
"""
import io
import os
from unittest import mock

from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku, UidBatch
from apps.common.models import IdCounter
from apps.packing.models import (
    Box,
    BoxConfiguration,
    BoxConfigurationVersion,
    BoxItem,
    ConfigurationItem,
    PackingSection,
    SectionOperator,
)


class SchemaFixtureMixin:
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("m1admin", password="a-long-test-password", role="ADMIN")
        cls.operator = User.objects.create_user("m1op", password="a-long-test-password")
        cls.sku = Sku.objects.create(code="sku001", name="Product One")
        cls.batch = UidBatch.objects.create(sku=cls.sku, quantity=3, created_by=cls.admin)
        cls.config = BoxConfiguration.objects.create(code="bc2", name="Box config 2")
        cls.version = BoxConfigurationVersion.objects.create(configuration=cls.config, version_no=1)
        ConfigurationItem.objects.create(version=cls.version, sku=cls.sku, quantity=25)
        cls.section = PackingSection.objects.create(
            code="a", name="Section A", active_config_version=cls.version
        )

    def make_uid(self, uid):
        return ProductUid.objects.create(uid=uid, sku=self.sku, batch=self.batch)

    def open_box(self):
        return Box.objects.create(
            section=self.section, config_version=self.version, opened_by=self.operator
        )

    def assert_db_rejects(self, func):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                func()


class ProductUidConstraintTests(SchemaFixtureMixin, TestCase):
    def test_codes_are_stored_uppercase(self):
        self.assertEqual(self.sku.code, "SKU001")
        self.assertEqual(self.section.code, "A")

    def test_lowercase_code_passes_form_validation(self):
        # Same path the admin uses: full_clean() before save().
        sku = Sku(code="sku009", name="Lower case")
        sku.full_clean()
        self.assertEqual(sku.code, "SKU009")
        section = PackingSection(code="b", name="Section B")
        section.full_clean()
        self.assertEqual(section.code, "B")
        config = BoxConfiguration(code="bc9", name="Config 9")
        config.full_clean()
        self.assertEqual(config.code, "BC9")
        
    def test_duplicate_uid_rejected(self):
        self.make_uid("483921")
        self.assert_db_rejects(lambda: self.make_uid("483921"))

    def test_uid_format_enforced(self):
        for bad in ("012345", "12345", "12A456", "BOX-01", "      "):
            with self.subTest(uid=bad):
                self.assert_db_rejects(lambda bad=bad: self.make_uid(bad))

    def test_void_requires_timestamp(self):
        uid = self.make_uid("729104")
        uid.status = ProductUid.Status.VOID
        self.assert_db_rejects(lambda: uid.save())

    def test_duplicate_sku_code_rejected_case_insensitive(self):
        self.assert_db_rejects(lambda: Sku.objects.create(code="Sku001", name="Dup"))

    def test_batch_quantity_range(self):
        self.assert_db_rejects(
            lambda: UidBatch.objects.create(sku=self.sku, quantity=0, created_by=self.admin)
        )


class ConfigurationConstraintTests(SchemaFixtureMixin, TestCase):
    def test_quantity_must_be_positive(self):
        other = Sku.objects.create(code="SKU002", name="Product Two")
        self.assert_db_rejects(
            lambda: ConfigurationItem.objects.create(version=self.version, sku=other, quantity=0)
        )

    def test_same_sku_twice_in_version_rejected(self):
        self.assert_db_rejects(
            lambda: ConfigurationItem.objects.create(version=self.version, sku=self.sku, quantity=5)
        )

    def test_duplicate_version_number_rejected(self):
        self.assert_db_rejects(
            lambda: BoxConfigurationVersion.objects.create(configuration=self.config, version_no=1)
        )

    def test_operator_assigned_once_per_section(self):
        SectionOperator.objects.create(section=self.section, user=self.operator)
        self.assert_db_rejects(
            lambda: SectionOperator.objects.create(section=self.section, user=self.operator)
        )


class BoxConstraintTests(SchemaFixtureMixin, TestCase):
    def test_only_one_open_box_per_section(self):
        self.open_box()
        self.assert_db_rejects(self.open_box)

    def test_completed_box_allowed_next_to_open_box(self):
        Box.objects.create(
            section=self.section, config_version=self.version, opened_by=self.operator,
            status=Box.Status.COMPLETED, box_uid="BOX-000001",
            completed_by=self.operator, completed_at=timezone.now(),
        )
        self.open_box()  # must not raise
        self.assertEqual(Box.objects.count(), 2)

    def test_completed_box_requires_box_uid(self):
        box = self.open_box()
        box.status = Box.Status.COMPLETED
        box.completed_at = timezone.now()
        self.assert_db_rejects(lambda: box.save())

    def test_open_box_cannot_have_box_uid(self):
        box = self.open_box()
        box.box_uid = "BOX-000002"
        self.assert_db_rejects(lambda: box.save())

    def test_box_uid_format_enforced(self):
        box = self.open_box()
        box.status = Box.Status.COMPLETED
        box.completed_at = timezone.now()
        box.box_uid = "483921"  # a product UID can never be a box UID
        self.assert_db_rejects(lambda: box.save())

    def test_product_cannot_be_in_two_boxes(self):
        uid = self.make_uid("195827")
        box_one = self.open_box()
        BoxItem.objects.create(box=box_one, product_uid=uid, scanned_by=self.operator)

        other_section = PackingSection.objects.create(
            code="B", name="Section B", active_config_version=self.version
        )
        box_two = Box.objects.create(
            section=other_section, config_version=self.version, opened_by=self.operator
        )
        self.assert_db_rejects(
            lambda: BoxItem.objects.create(box=box_two, product_uid=uid, scanned_by=self.operator)
        )

    def test_used_configuration_version_is_locked(self):
        self.assertFalse(self.version.is_locked)
        self.open_box()
        self.assertTrue(self.version.is_locked)


class IdCounterTests(TestCase):
    def test_allocate_is_sequential_and_gapless(self):
        self.assertEqual(IdCounter.allocate("BOX"), 1)
        self.assertEqual(IdCounter.allocate("BOX"), 2)
        self.assertEqual(IdCounter.allocate("BOX", count=10), 3)
        self.assertEqual(IdCounter.allocate("BOX"), 13)

    def test_rolled_back_allocation_is_reused(self):
        try:
            with transaction.atomic():
                IdCounter.allocate("BOX")
                raise RuntimeError("simulate failure")
        except RuntimeError:
            pass
        self.assertEqual(IdCounter.allocate("BOX"), 1)


class CreateUserCommandTests(TestCase):
    def test_creates_admin_from_environment_password(self):
        with mock.patch.dict(os.environ, {"AMPL_USER_PASSWORD": "Str0ng-Test-Passw0rd"}):
            call_command("create_ampl_user", "--username", "boss", "--role", "ADMIN", stdout=io.StringIO())
        user = User.objects.get(username="boss")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertTrue(user.is_staff and user.is_superuser)
        self.assertTrue(user.check_password("Str0ng-Test-Passw0rd"))

    def test_creates_operator_and_assigns_section(self):
        PackingSection.objects.create(code="A", name="Section A")
        with mock.patch.dict(os.environ, {"AMPL_USER_PASSWORD": "Str0ng-Test-Passw0rd"}):
            call_command(
                "create_ampl_user", "--username", "op7", "--role", "OPERATOR", "--section", "a",
                stdout=io.StringIO(),
            )
        user = User.objects.get(username="op7")
        self.assertEqual(user.role, User.Role.OPERATOR)
        self.assertFalse(user.is_staff)
        self.assertTrue(SectionOperator.objects.filter(user=user, section__code="A").exists())
