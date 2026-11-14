from django.contrib import admin

from apps.catalog.admin import ReadOnlyAdmin

from .models import (
    Box,
    BoxConfiguration,
    BoxConfigurationVersion,
    BoxItem,
    BoxVerification,
    ConfigurationItem,
    PackingSection,
    ScanLog,
    SectionOperator,
)


@admin.register(BoxConfiguration)
class BoxConfigurationAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    readonly_fields = ("created_by", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return False


class ConfigurationItemInline(admin.TabularInline):
    model = ConfigurationItem
    extra = 1
    autocomplete_fields = ("sku",)

    def _locked(self, obj):
        return obj is not None and obj.is_locked

    def has_add_permission(self, request, obj=None):
        return not self._locked(obj)

    def has_change_permission(self, request, obj=None):
        return not self._locked(obj)

    def has_delete_permission(self, request, obj=None):
        return not self._locked(obj)


@admin.register(BoxConfigurationVersion)
class BoxConfigurationVersionAdmin(admin.ModelAdmin):
    list_display = ("__str__", "configuration", "version_no", "created_at")
    list_filter = ("configuration",)
    inlines = [ConfigurationItemInline]
    readonly_fields = ("created_by", "created_at")

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_change_permission(self, request, obj=None):
        # A version already used by a box is frozen.
        if obj is not None and obj.is_locked:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False


class SectionOperatorInline(admin.TabularInline):
    model = SectionOperator
    fk_name = "section"
    extra = 1
    fields = ("user", "assigned_by", "assigned_at")
    readonly_fields = ("assigned_by", "assigned_at")


@admin.register(PackingSection)
class PackingSectionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "active_config_version", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    inlines = [SectionOperatorInline]

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, SectionOperator) and instance.assigned_by_id is None:
                instance.assigned_by = request.user
            instance.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()

    def has_delete_permission(self, request, obj=None):
        return False


class BoxItemInline(admin.TabularInline):
    model = BoxItem
    extra = 0
    fields = ("product_uid", "scanned_by", "scanned_at")
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Box)
class BoxAdmin(ReadOnlyAdmin):
    list_display = ("__str__", "section", "config_version", "status", "opened_by", "opened_at", "completed_at")
    list_filter = ("status", "section")
    search_fields = ("box_uid",)
    inlines = [BoxItemInline]


@admin.register(BoxVerification)
class BoxVerificationAdmin(ReadOnlyAdmin):
    list_display = ("box", "method", "result", "verified_by", "verified_at")
    list_filter = ("method", "result")


@admin.register(ScanLog)
class ScanLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "action", "accepted", "result_code", "user", "box", "raw_value")
    list_filter = ("action", "accepted", "result_code")
    search_fields = ("raw_value", "parsed_value", "box__box_uid")
