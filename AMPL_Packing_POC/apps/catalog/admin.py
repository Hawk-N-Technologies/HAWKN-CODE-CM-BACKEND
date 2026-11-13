from django.contrib import admin

from .models import ProductUid, Sku, UidBatch


class ReadOnlyAdmin(admin.ModelAdmin):
    """Records created only by the application (never edited by hand)."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Sku)
class SkuAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    readonly_fields = ("created_by", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return False  # deactivate instead


@admin.register(UidBatch)
class UidBatchAdmin(ReadOnlyAdmin):
    list_display = ("id", "sku", "quantity", "created_by", "created_at")
    list_filter = ("sku",)


@admin.register(ProductUid)
class ProductUidAdmin(ReadOnlyAdmin):
    list_display = ("uid", "sku", "status", "batch", "created_at", "packed_at")
    list_filter = ("status", "sku")
    search_fields = ("uid",)
    list_select_related = ("sku", "batch")
