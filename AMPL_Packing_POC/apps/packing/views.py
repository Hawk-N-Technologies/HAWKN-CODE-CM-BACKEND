"""
Packing API used by the operator's phone.

Every rule lives in services/box_service.py; these views only translate
HTTP to service calls. Rejections come back as the standard error envelope
with a `code` (e.g. SKU_QUANTITY_FULL) and HTTP 403/404/409/422.
"""
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.accounts.permissions import IsAmplUser
from apps.accounts.serializers import sections_for
from apps.common.exceptions import AppError
from apps.common.responses import success_response

from .models import Box, BoxVerification, PackingSection
from .serializers import box_detail, box_record, section_payload
from .services.box_service import (
    cancel_box,
    complete_box,
    remove_item,
    scan_product,
    start_box,
    user_can_pack,
)
from .services.verification_service import BOX_RELATED as RECORD_RELATED
from .services.verification_service import lookup_box, record_verification

BOX_RELATED = (
    "section", "config_version", "config_version__configuration",
    "opened_by", "completed_by",
)


def get_box_for(user, public_id) -> Box:
    box = get_object_or_404(Box.objects.select_related(*BOX_RELATED), public_id=public_id)
    if not user_can_pack(user, box.section):
        raise AppError(
            "SECTION_NOT_ASSIGNED",
            "You are not assigned to this packing section.",
            status.HTTP_403_FORBIDDEN,
        )
    return box


def fresh_box(box) -> Box:
    return Box.objects.select_related(*BOX_RELATED).get(pk=box.pk)


class MySectionsView(APIView):
    """GET /my/sections - sections the user may pack in, with any open box."""

    permission_classes = [IsAmplUser]

    def get(self, request):
        sections = list(sections_for(request.user))
        open_boxes = {
            box.section_id: box
            for box in Box.objects.filter(
                section__in=sections, status=Box.Status.OPEN
            ).select_related("section", "config_version")
        }
        return success_response(
            [section_payload(section, open_boxes.get(section.pk)) for section in sections]
        )


class StartBoxView(APIView):
    """POST /sections/{id}/boxes - 201 new box, or 200 with the box already open."""

    permission_classes = [IsAmplUser]

    def post(self, request, pk):
        section = get_object_or_404(PackingSection, pk=pk)
        box, created = start_box(section=section, user=request.user)
        return success_response(
            box_detail(fresh_box(box)),
            message="New box started." if created else "Continuing the open box.",
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BoxDetailView(APIView):
    """GET /boxes/{public_id}"""

    permission_classes = [IsAmplUser]

    def get(self, request, public_id):
        return success_response(box_detail(get_box_for(request.user, public_id)))


class BoxScanView(APIView):
    """POST /boxes/{public_id}/scans {raw_value, client_scan_id}"""

    permission_classes = [IsAmplUser]

    def post(self, request, public_id):
        box = get_box_for(request.user, public_id)
        result = scan_product(
            box=box,
            raw_value=request.data.get("raw_value", ""),
            user=request.user,
            client_scan_id=request.data.get("client_scan_id") or "",
        )
        return success_response(result, message=f"Added {result['product']['uid']}.")


class BoxItemView(APIView):
    """DELETE /boxes/{public_id}/items/{uid} {reason} - remove a wrong scan."""

    permission_classes = [IsAmplUser]

    def delete(self, request, public_id, uid):
        box = get_box_for(request.user, public_id)
        result = remove_item(
            box=box, uid=uid, user=request.user, reason=request.data.get("reason", "")
        )
        return success_response(result, message=f"Removed {result['removed_uid']}.")


class BoxCompleteView(APIView):
    """POST /boxes/{public_id}/complete - safe to repeat."""

    permission_classes = [IsAmplUser]

    def post(self, request, public_id):
        box = get_box_for(request.user, public_id)
        result = complete_box(box=box, user=request.user)
        data = box_detail(fresh_box(result["box"]))
        data["already_completed"] = result["already_completed"]
        return success_response(data, message=f"Box {data['box_uid']} completed.")


class BoxCancelView(APIView):
    """POST /boxes/{public_id}/cancel {reason}"""

    permission_classes = [IsAmplUser]

    def post(self, request, public_id):
        box = get_box_for(request.user, public_id)
        cancelled = cancel_box(box=box, user=request.user, reason=request.data.get("reason"))
        return success_response(box_detail(fresh_box(cancelled)), message="Box cancelled.")


# ---------------------------------------------------------------------------
# Verification (any AMPL admin or operator may verify any box)
# ---------------------------------------------------------------------------
class BoxLookupView(APIView):
    """GET /boxes/lookup?code=BOX-000001 - the box record, from its label."""

    permission_classes = [IsAmplUser]

    def get(self, request):
        box = lookup_box(raw_value=request.query_params.get("code", ""), user=request.user)
        return success_response(box_record(box))


class VerificationInput(serializers.Serializer):
    method = serializers.ChoiceField(choices=BoxVerification.Method.choices)
    result = serializers.ChoiceField(choices=BoxVerification.Result.choices)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class BoxVerificationView(APIView):
    """POST /boxes/{public_id}/verifications {method, result, notes}"""

    permission_classes = [IsAmplUser]

    def post(self, request, public_id):
        box = get_object_or_404(Box.objects.select_related(*RECORD_RELATED), public_id=public_id)
        payload = VerificationInput(data=request.data)
        payload.is_valid(raise_exception=True)
        updated = record_verification(box=box, user=request.user, **payload.validated_data)
        data = box_record(Box.objects.select_related(*RECORD_RELATED).get(pk=updated.pk))
        return success_response(data, message="Verification saved.", status=status.HTTP_201_CREATED)
