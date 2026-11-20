"""
Dashboard counters, packing history and scan log (admin only).
Counts and lists only - no charts or analytics.
"""
from datetime import date

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.views import APIView

from apps.accounts.permissions import IsAmplAdmin
from apps.catalog.models import ProductUid
from apps.catalog.services.uid_generation import capacity_info
from apps.common.exceptions import AppError
from apps.common.responses import success_response
from apps.packing.models import Box, BoxVerification, ConfigurationItem, ScanLog

TRUE_WORDS = {"1", "true", "yes"}
FALSE_WORDS = {"0", "false", "no"}


def _parse_date(params, name):
    value = params.get(name, "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise AppError(
            "INVALID_DATE", f"{name} must be a date like 2026-11-14.", status.HTTP_422_UNPROCESSABLE_ENTITY
        ) from exc


def _name(user):
    return (user.get_full_name() or user.username) if user else None


def latest_verification_result():
    return Subquery(
        BoxVerification.objects.filter(box=OuterRef("pk")).order_by("-verified_at", "-id").values("result")[:1]
    )


def expected_quantity():
    return Subquery(
        ConfigurationItem.objects.filter(version=OuterRef("config_version"))
        .order_by()
        .values("version")
        .annotate(total=Sum("quantity"))
        .values("total")[:1],
        output_field=IntegerField(),
    )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardSummaryView(APIView):
    """GET /dashboard/summary"""

    permission_classes = [IsAmplAdmin]

    def get(self, request):
        uid_counts = ProductUid.objects.aggregate(
            total=Count("id"),
            available=Count("id", filter=Q(status=ProductUid.Status.AVAILABLE)),
            in_box=Count("id", filter=Q(status=ProductUid.Status.IN_BOX)),
            packed=Count("id", filter=Q(status=ProductUid.Status.PACKED)),
            void=Count("id", filter=Q(status=ProductUid.Status.VOID)),
        )
        done = [Box.Status.COMPLETED, Box.Status.VERIFIED]
        status_counts = Box.objects.aggregate(
            open=Count("id", filter=Q(status=Box.Status.OPEN)),
            completed=Count("id", filter=Q(status__in=done)),
            verified=Count("id", filter=Q(status=Box.Status.VERIFIED)),
            cancelled=Count("id", filter=Q(status=Box.Status.CANCELLED)),
        )
        finished = Box.objects.filter(status__in=done).annotate(latest_result=latest_verification_result())
        box_counts = {
            "open": status_counts["open"],
            "completed": status_counts["completed"],
            "verified": status_counts["verified"],
            "mismatch": finished.filter(latest_result=BoxVerification.Result.MISMATCH).count(),
            "not_verified": finished.filter(latest_result__isnull=True).count(),
            "cancelled": status_counts["cancelled"],
        }
        today = timezone.localdate()
        completed_today = Box.objects.filter(status__in=done, completed_at__date=today)
        return success_response({
            "product_uids": uid_counts,
            "boxes": box_counts,
            "today": {
                "date": today.isoformat(),
                "boxes_completed": completed_today.count(),
                "products_packed": ProductUid.objects.filter(
                    status=ProductUid.Status.PACKED, packed_at__date=today
                ).count(),
            },
            "uid_capacity": capacity_info(),
        })


# ---------------------------------------------------------------------------
# Packing history
# ---------------------------------------------------------------------------
class PackingHistoryView(ListAPIView):
    """
    GET /boxes?status=&section=&operator=&date_from=&date_to=&q=
    status: OPEN, COMPLETED, VERIFIED, CANCELLED or MISMATCH.
    Dates filter on packing time (completed, else cancelled, else opened).
    """

    permission_classes = [IsAmplAdmin]

    def get_queryset(self):
        params = self.request.query_params
        qs = (
            Box.objects.select_related(
                "section", "config_version", "config_version__configuration", "opened_by", "completed_by"
            )
            .annotate(
                activity_at=Coalesce("completed_at", "cancelled_at", "opened_at"),
                quantity=Count("items", distinct=True),
                expected=expected_quantity(),
                latest_result=latest_verification_result(),
            )
            .order_by("-activity_at", "-id")
        )
        status_value = params.get("status", "").strip().upper()
        if status_value == "MISMATCH":
            qs = qs.filter(latest_result=BoxVerification.Result.MISMATCH,
                           status__in=[Box.Status.COMPLETED, Box.Status.VERIFIED])
        elif status_value in Box.Status.values:
            qs = qs.filter(status=status_value)
        section = params.get("section", "").strip()
        if section.isdigit():
            qs = qs.filter(section_id=int(section))
        operator = params.get("operator", "").strip()
        if operator.isdigit():
            qs = qs.filter(Q(completed_by_id=int(operator)) | Q(opened_by_id=int(operator)))
        date_from = _parse_date(params, "date_from")
        if date_from:
            qs = qs.filter(activity_at__date__gte=date_from)
        date_to = _parse_date(params, "date_to")
        if date_to:
            qs = qs.filter(activity_at__date__lte=date_to)
        q = params.get("q", "").strip().upper()
        if q:
            qs = qs.filter(box_uid__icontains=q)
        return qs

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response([self.row(box) for box in page])

    @staticmethod
    def row(box):
        if box.status in (Box.Status.COMPLETED, Box.Status.VERIFIED):
            verification = {None: "NOT_VERIFIED", "MATCH": "VERIFIED", "MISMATCH": "MISMATCH"}[box.latest_result]
        else:
            verification = None
        return {
            "public_id": str(box.public_id),
            "box_uid": box.box_uid,
            "status": box.status,
            "verification_status": verification,
            "configuration": str(box.config_version),
            "section_id": box.section_id,
            "section_code": box.section.code,
            "operator": _name(box.completed_by or box.opened_by),
            "opened_at": box.opened_at,
            "completed_at": box.completed_at,
            "cancelled_at": box.cancelled_at,
            "cancel_reason": box.cancel_reason,
            "quantity": box.quantity,
            "expected": box.expected or 0,
        }


# ---------------------------------------------------------------------------
# Scan log
# ---------------------------------------------------------------------------
class ScanLogView(ListAPIView):
    """GET /scan-logs?accepted=&action=&q=&date_from=&date_to="""

    permission_classes = [IsAmplAdmin]

    def get_queryset(self):
        params = self.request.query_params
        qs = ScanLog.objects.select_related("user", "section", "box", "product_uid").order_by("-created_at", "-id")
        accepted = params.get("accepted", "").strip().lower()
        if accepted in TRUE_WORDS:
            qs = qs.filter(accepted=True)
        elif accepted in FALSE_WORDS:
            qs = qs.filter(accepted=False)
        action = params.get("action", "").strip().upper()
        if action in ScanLog.Action.values:
            qs = qs.filter(action=action)
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(raw_value__icontains=q) | Q(parsed_value__icontains=q)
                | Q(box__box_uid__icontains=q) | Q(result_code__icontains=q)
            )
        date_from = _parse_date(params, "date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = _parse_date(params, "date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response([
            {
                "id": log.pk,
                "created_at": log.created_at,
                "action": log.action,
                "action_label": log.get_action_display(),
                "accepted": log.accepted,
                "result_code": log.result_code,
                "message": log.message,
                "raw_value": log.raw_value,
                "parsed_value": log.parsed_value,
                "user": _name(log.user),
                "section_code": log.section.code if log.section else None,
                "box_uid": log.box.box_uid if log.box else None,
                "box_public_id": str(log.box.public_id) if log.box else None,
                "product_uid": log.product_uid.uid if log.product_uid else None,
            }
            for log in page
        ])
