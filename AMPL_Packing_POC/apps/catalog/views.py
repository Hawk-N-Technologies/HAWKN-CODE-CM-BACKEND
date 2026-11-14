import csv

from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.views import APIView

from apps.accounts.permissions import IsAmplAdmin
from apps.common.responses import success_response
from apps.packing.models import ScanLog

from .models import ProductUid, Sku, UidBatch
from .serializers import (
    ProductUidSerializer,
    SkuSerializer,
    UidBatchDetailSerializer,
    UidBatchSerializer,
)
from .services.uid_generation import capacity_info, generate_uids, void_uid

TRUE_WORDS = {"1", "true", "yes"}
FALSE_WORDS = {"0", "false", "no"}


def skus_with_counts():
    status_count = {
        f"uid_{key}": Count("product_uids", filter=Q(product_uids__status=value))
        for key, value in (
            ("available", ProductUid.Status.AVAILABLE),
            ("in_box", ProductUid.Status.IN_BOX),
            ("packed", ProductUid.Status.PACKED),
            ("void", ProductUid.Status.VOID),
        )
    }
    return Sku.objects.annotate(uid_total=Count("product_uids"), **status_count).order_by("code")


# ---------------------------------------------------------------------------
# SKUs
# ---------------------------------------------------------------------------
class SkuListCreateView(ListAPIView):
    """GET /skus?q=&is_active=   POST /skus {code, name, description}"""

    permission_classes = [IsAmplAdmin]
    serializer_class = SkuSerializer

    def get_queryset(self):
        qs = skus_with_counts()
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q))
        active = self.request.query_params.get("is_active", "").strip().lower()
        if active in TRUE_WORDS:
            qs = qs.filter(is_active=True)
        elif active in FALSE_WORDS:
            qs = qs.filter(is_active=False)
        return qs

    def post(self, request):
        serializer = SkuSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sku = serializer.save(created_by=request.user)
        fresh = skus_with_counts().get(pk=sku.pk)
        return success_response(
            SkuSerializer(fresh).data, message=f"SKU {sku.code} created.",
            status=status.HTTP_201_CREATED,
        )


class SkuDetailView(APIView):
    """GET /skus/{id}   PATCH /skus/{id} {name, description, is_active}"""

    permission_classes = [IsAmplAdmin]

    def get(self, request, pk):
        return success_response(SkuSerializer(get_object_or_404(skus_with_counts(), pk=pk)).data)

    def patch(self, request, pk):
        sku = get_object_or_404(Sku, pk=pk)
        serializer = SkuSerializer(sku, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        fresh = skus_with_counts().get(pk=sku.pk)
        return success_response(SkuSerializer(fresh).data, message="SKU updated.")


# ---------------------------------------------------------------------------
# UID batches
# ---------------------------------------------------------------------------
class SkuUidBatchCreateView(APIView):
    """POST /skus/{id}/uid-batches {quantity}"""

    permission_classes = [IsAmplAdmin]

    def post(self, request, pk):
        sku = get_object_or_404(Sku, pk=pk)
        batch = generate_uids(sku=sku, quantity=request.data.get("quantity"), user=request.user)
        batch = UidBatch.objects.select_related("sku", "created_by").get(pk=batch.pk)
        return success_response(
            UidBatchDetailSerializer(batch).data,
            message=f"{batch.quantity} UIDs generated for {sku.code}.",
            status=status.HTTP_201_CREATED,
        )


class UidBatchListView(ListAPIView):
    """GET /uid-batches?sku=<id>"""

    permission_classes = [IsAmplAdmin]
    serializer_class = UidBatchSerializer

    def get_queryset(self):
        qs = UidBatch.objects.select_related("sku", "created_by").order_by("-created_at", "-id")
        sku = self.request.query_params.get("sku", "").strip()
        if sku.isdigit():
            qs = qs.filter(sku_id=int(sku))
        return qs


class UidBatchDetailView(APIView):
    """GET /uid-batches/{id} - batch with all its UIDs"""

    permission_classes = [IsAmplAdmin]

    def get(self, request, pk):
        batch = get_object_or_404(UidBatch.objects.select_related("sku", "created_by"), pk=pk)
        return success_response(UidBatchDetailSerializer(batch).data)


@require_GET
def uid_batch_export_csv(request, pk):
    """
    GET /uid-batches/{id}/export.csv
    Plain Django view (not DRF) so browsers can download it directly.
    """
    user = request.user
    if not user.is_authenticated:
        return JsonResponse(
            {"success": False, "code": "NOT_AUTHENTICATED", "message": "Please log in."}, status=401
        )
    if not getattr(user, "is_ampl_admin", False) or not user.is_active:
        return JsonResponse(
            {"success": False, "code": "PERMISSION_DENIED", "message": "Only an AMPL admin can do this."},
            status=403,
        )
    batch = get_object_or_404(UidBatch.objects.select_related("sku"), pk=pk)
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    stamp = timezone.localtime(batch.created_at).strftime("%Y%m%d-%H%M")
    response["Content-Disposition"] = (
        f'attachment; filename="uids_{batch.sku.code}_batch{batch.pk}_{stamp}.csv"'
    )
    response.write("﻿")  # lets Excel detect UTF-8
    writer = csv.writer(response)
    writer.writerow(["uid", "sku_code", "sku_name", "status", "batch_id", "created_at"])
    for uid, status_value, created in batch.product_uids.order_by("id").values_list(
        "uid", "status", "created_at"
    ):
        writer.writerow([
            uid, batch.sku.code, batch.sku.name, status_value, batch.pk,
            timezone.localtime(created).strftime("%Y-%m-%d %H:%M:%S"),
        ])
    return response


# ---------------------------------------------------------------------------
# Product UIDs
# ---------------------------------------------------------------------------
class ProductUidListView(ListAPIView):
    """GET /product-uids?sku=&status=&batch=&q="""

    permission_classes = [IsAmplAdmin]
    serializer_class = ProductUidSerializer

    def get_queryset(self):
        params = self.request.query_params
        qs = ProductUid.objects.select_related("sku", "box_item__box").order_by("uid")
        sku = params.get("sku", "").strip()
        if sku.isdigit():
            qs = qs.filter(sku_id=int(sku))
        batch = params.get("batch", "").strip()
        if batch.isdigit():
            qs = qs.filter(batch_id=int(batch))
        status_value = params.get("status", "").strip().upper()
        if status_value in ProductUid.Status.values:
            qs = qs.filter(status=status_value)
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(uid__startswith=q)
        return qs


class ProductUidDetailView(APIView):
    """GET /product-uids/{uid} - UID with its box and scan history"""

    permission_classes = [IsAmplAdmin]

    def get(self, request, uid):
        product = get_object_or_404(
            ProductUid.objects.select_related("sku", "box_item__box"), uid=uid
        )
        history = (
            ScanLog.objects.filter(product_uid=product)
            .select_related("box", "user")
            .order_by("-created_at")[:50]
        )
        data = ProductUidSerializer(product).data
        data["history"] = [
            {
                "at": log.created_at,
                "action": log.action,
                "accepted": log.accepted,
                "result_code": log.result_code,
                "message": log.message,
                "box_uid": log.box.box_uid if log.box else None,
                "user": log.user.username if log.user else None,
            }
            for log in history
        ]
        return success_response(data)


class ProductUidVoidView(APIView):
    """POST /product-uids/{uid}/void {reason}"""

    permission_classes = [IsAmplAdmin]

    def post(self, request, uid):
        product = get_object_or_404(ProductUid, uid=uid)
        void_uid(product_uid=product, user=request.user, reason=request.data.get("reason"))
        fresh = ProductUid.objects.select_related("sku", "box_item__box").get(pk=product.pk)
        return success_response(ProductUidSerializer(fresh).data, message=f"UID {uid} voided.")


class UidCapacityView(APIView):
    """GET /uid-capacity"""

    permission_classes = [IsAmplAdmin]

    def get(self, request):
        return success_response(capacity_info())
