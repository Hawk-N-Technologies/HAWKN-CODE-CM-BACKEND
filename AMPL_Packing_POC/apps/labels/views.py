"""
Label data for printing.

- JSON endpoints (DRF) give the print pages everything in one request.
- *.svg endpoints are plain Django views so an <img src> or a browser
  can open them directly.
QR images are generated from the identifier each time; nothing is stored.
"""
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView

from apps.accounts.permissions import IsAmplAdmin, IsAmplUser
from apps.catalog.models import ProductUid, UidBatch
from apps.common.exceptions import AppError
from apps.common.responses import success_response
from apps.packing.models import Box
from apps.packing.services.box_service import user_can_pack

from .qr import qr_svg

BATCH_PAGE_SIZE = 1000
DONE_STATUSES = (Box.Status.COMPLETED, Box.Status.VERIFIED)


def _svg_response(svg: str) -> HttpResponse:
    response = HttpResponse(svg, content_type="image/svg+xml; charset=utf-8")
    response["Cache-Control"] = "private, max-age=86400"  # same ID -> same QR
    return response


def _json_error(code, message, http_status):
    return JsonResponse({"success": False, "code": code, "message": message}, status=http_status)


def _login_problem(user, admin_only):
    if not user.is_authenticated:
        return _json_error("NOT_AUTHENTICATED", "Please log in.", 401)
    if not user.is_active or (admin_only and not getattr(user, "is_ampl_admin", False)):
        return _json_error("PERMISSION_DENIED", "You are not allowed to do this.", 403)
    if not (getattr(user, "is_ampl_admin", False) or getattr(user, "is_ampl_operator", False)):
        return _json_error("PERMISSION_DENIED", "You are not allowed to do this.", 403)
    return None


# ---------------------------------------------------------------------------
# Plain SVG images
# ---------------------------------------------------------------------------
def product_qr_svg(request, uid):
    """GET /product-uids/{uid}/qr.svg (admin)"""
    problem = _login_problem(request.user, admin_only=True)
    if problem:
        return problem
    product = ProductUid.objects.filter(uid=uid).first()
    if product is None:
        return _json_error("NOT_FOUND", f"Unknown product UID {uid}.", 404)
    return _svg_response(qr_svg(product.uid))


def box_qr_svg(request, box_uid):
    """GET /boxes/{box_uid}/qr.svg (admin or operator of that section)"""
    problem = _login_problem(request.user, admin_only=False)
    if problem:
        return problem
    box = Box.objects.select_related("section").filter(box_uid=box_uid.upper()).first()
    if box is None:
        return _json_error("NOT_FOUND", f"Unknown box {box_uid}.", 404)
    if not user_can_pack(request.user, box.section):
        return _json_error("SECTION_NOT_ASSIGNED", "You are not assigned to this packing section.", 403)
    return _svg_response(qr_svg(box.box_uid))


# ---------------------------------------------------------------------------
# JSON for the print pages
# ---------------------------------------------------------------------------
class BatchLabelsView(APIView):
    """GET /uid-batches/{id}/labels?page=1 - up to 1000 labels per page."""

    permission_classes = [IsAmplAdmin]

    def get(self, request, pk):
        batch = get_object_or_404(UidBatch.objects.select_related("sku"), pk=pk)
        try:
            page = max(int(request.query_params.get("page", 1)), 1)
        except ValueError:
            page = 1
        rows = batch.product_uids.order_by("id").values_list("uid", "status")
        total = rows.count()
        total_pages = max((total + BATCH_PAGE_SIZE - 1) // BATCH_PAGE_SIZE, 1)
        start = (page - 1) * BATCH_PAGE_SIZE
        labels = [
            {"uid": uid, "status": status_value, "svg": qr_svg(uid)}
            for uid, status_value in rows[start:start + BATCH_PAGE_SIZE]
        ]
        return success_response({
            "batch": {
                "id": batch.pk,
                "sku_code": batch.sku.code,
                "sku_name": batch.sku.name,
                "quantity": batch.quantity,
                "created_at": batch.created_at,
            },
            "labels": labels,
            "page": page,
            "total_pages": total_pages,
            "total_labels": total,
        })


class BoxLabelView(APIView):
    """GET /boxes/{public_id}/label - data for the 50 x 35 mm box label."""

    permission_classes = [IsAmplUser]

    def get(self, request, public_id):
        box = get_object_or_404(
            Box.objects.select_related("section", "config_version", "config_version__configuration"),
            public_id=public_id,
        )
        if not user_can_pack(request.user, box.section):
            raise AppError(
                "SECTION_NOT_ASSIGNED",
                "You are not assigned to this packing section.",
                status.HTTP_403_FORBIDDEN,
            )
        if box.status not in DONE_STATUSES:
            raise AppError(
                "BOX_NOT_COMPLETED",
                "Only a completed box has a box ID and label.",
                status.HTTP_409_CONFLICT,
            )
        return success_response({
            "public_id": str(box.public_id),
            "box_uid": box.box_uid,
            "section_code": box.section.code,
            "config_label": str(box.config_version),
            "total_items": box.items.count(),
            "completed_at": box.completed_at,
            "svg": qr_svg(box.box_uid),
        })
