import re

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from .models import CODE_REGEX, ProductUid, Sku, UidBatch, normalize_code


class SkuSerializer(serializers.ModelSerializer):
    # Declared explicitly: no automatic exact-match unique check, because
    # codes are compared case-insensitively in validate_code().
    code = serializers.CharField(max_length=32)
    counts = serializers.SerializerMethodField()

    class Meta:
        model = Sku
        fields = ["id", "code", "name", "description", "is_active", "counts",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "counts", "created_at", "updated_at"]

    def validate_code(self, value):
        code = normalize_code(value)
        if self.instance is not None and code != self.instance.code:
            raise serializers.ValidationError("SKU code cannot be changed once created.")
        if not re.fullmatch(CODE_REGEX, code):
            raise serializers.ValidationError(
                "Use letters, digits, '-' or '_' only, starting with a letter or digit."
            )
        duplicate = Sku.objects.filter(code=code)
        if self.instance is not None:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError(f"SKU {code} already exists.")
        return code

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def get_counts(self, obj):
        return {
            "total": getattr(obj, "uid_total", 0),
            "available": getattr(obj, "uid_available", 0),
            "in_box": getattr(obj, "uid_in_box", 0),
            "packed": getattr(obj, "uid_packed", 0),
            "void": getattr(obj, "uid_void", 0),
        }


class UidBatchSerializer(serializers.ModelSerializer):
    sku = serializers.SerializerMethodField()
    created_by = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = UidBatch
        fields = ["id", "sku", "quantity", "created_by", "created_at"]

    def get_sku(self, obj):
        return {"id": obj.sku_id, "code": obj.sku.code, "name": obj.sku.name}


class UidBatchDetailSerializer(UidBatchSerializer):
    uids = serializers.SerializerMethodField()

    class Meta(UidBatchSerializer.Meta):
        fields = UidBatchSerializer.Meta.fields + ["uids"]

    def get_uids(self, obj):
        return [
            {"uid": uid, "status": status_value}
            for uid, status_value in obj.product_uids.order_by("id").values_list("uid", "status")
        ]


def _box_uid(product):
    try:
        item = product.box_item
    except ObjectDoesNotExist:
        return None
    return item.box.box_uid


class ProductUidSerializer(serializers.ModelSerializer):
    sku_id = serializers.IntegerField(read_only=True)
    batch_id = serializers.IntegerField(read_only=True)
    sku_code = serializers.CharField(source="sku.code", read_only=True)
    sku_name = serializers.CharField(source="sku.name", read_only=True)
    box_uid = serializers.SerializerMethodField()

    class Meta:
        model = ProductUid
        fields = ["uid", "sku_id", "sku_code", "sku_name", "status", "batch_id", "box_uid",
                  "created_at", "packed_at", "voided_at", "void_reason"]

    def get_box_uid(self, obj):
        return _box_uid(obj)
