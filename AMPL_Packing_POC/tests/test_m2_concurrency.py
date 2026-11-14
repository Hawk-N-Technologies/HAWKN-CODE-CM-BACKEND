"""
M2: real parallel requests against PostgreSQL (each thread has its own
database connection), proving the locks work - not just the happy path.
"""
import threading

from django.db import close_old_connections, connection
from django.test import TransactionTestCase

from apps.accounts.models import User
from apps.catalog.models import ProductUid, Sku
from apps.catalog.services.uid_generation import generate_uids
from apps.common.exceptions import AppError
from apps.common.models import IdCounter
from apps.packing.models import (
    Box,
    BoxConfiguration,
    BoxConfigurationVersion,
    BoxItem,
    ConfigurationItem,
    PackingSection,
)
from apps.packing.services.box_service import complete_box, scan_product, start_box


def run_in_parallel(target, count):
    """Start `count` threads at the same instant; return their results."""
    barrier = threading.Barrier(count)
    results = [None] * count

    def worker(index):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            results[index] = ("ok", target(index))
        except AppError as exc:
            results[index] = ("error", exc.error_code)
        except Exception as exc:  # noqa: BLE001 - reported to the test
            results[index] = ("crash", repr(exc))
        finally:
            connection.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return results


class ConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user("cc_admin", password="a-long-test-password", role="ADMIN")
        sku = Sku.objects.create(code="SKU001", name="Product One")
        config = BoxConfiguration.objects.create(code="BC2", name="Two of SKU001")
        version = BoxConfigurationVersion.objects.create(configuration=config, version_no=1)
        ConfigurationItem.objects.create(version=version, sku=sku, quantity=2)
        self.section_a = PackingSection.objects.create(code="A", name="A", active_config_version=version)
        self.section_b = PackingSection.objects.create(code="B", name="B", active_config_version=version)
        generate_uids(sku=sku, quantity=6, user=self.admin)
        self.uids = list(ProductUid.objects.order_by("id").values_list("uid", flat=True))

    def test_double_completion_creates_one_box_number(self):
        box, _ = start_box(section=self.section_a, user=self.admin)
        for uid in self.uids[:2]:
            scan_product(box=box, raw_value=uid, user=self.admin)

        results = run_in_parallel(
            lambda i: complete_box(box=Box.objects.get(pk=box.pk), user=self.admin)["box"].box_uid,
            4,
        )
        self.assertEqual([r[0] for r in results], ["ok"] * 4, results)
        self.assertEqual({r[1] for r in results}, {"BOX-000001"})
        self.assertEqual(IdCounter.objects.get(name="BOX").next_value, 2)

    def test_same_product_into_two_boxes_only_once(self):
        box_a, _ = start_box(section=self.section_a, user=self.admin)
        box_b, _ = start_box(section=self.section_b, user=self.admin)
        boxes = [box_a.pk, box_b.pk]
        uid = self.uids[0]

        results = run_in_parallel(
            lambda i: scan_product(
                box=Box.objects.get(pk=boxes[i]), raw_value=uid, user=self.admin
            )["accepted"],
            2,
        )
        outcomes = sorted(r[0] for r in results)
        self.assertEqual(outcomes, ["error", "ok"], results)
        self.assertIn("IN_OTHER_BOX", [r[1] for r in results])
        self.assertEqual(BoxItem.objects.filter(product_uid__uid=uid).count(), 1)

    def test_parallel_starts_open_one_box(self):
        results = run_in_parallel(
            lambda i: start_box(
                section=PackingSection.objects.get(pk=self.section_a.pk), user=self.admin
            )[0].pk,
            4,
        )
        self.assertEqual([r[0] for r in results], ["ok"] * 4, results)
        self.assertEqual(len({r[1] for r in results}), 1)
        self.assertEqual(Box.objects.filter(section=self.section_a, status=Box.Status.OPEN).count(), 1)

    def test_parallel_uid_batches_never_overlap(self):
        sku = Sku.objects.get(code="SKU001")
        results = run_in_parallel(
            lambda i: generate_uids(sku=Sku.objects.get(pk=sku.pk), quantity=50, user=self.admin).pk,
            3,
        )
        self.assertEqual([r[0] for r in results], ["ok"] * 3, results)
        all_uids = list(ProductUid.objects.values_list("uid", flat=True))
        self.assertEqual(len(all_uids), 6 + 150)
        self.assertEqual(len(set(all_uids)), len(all_uids))
