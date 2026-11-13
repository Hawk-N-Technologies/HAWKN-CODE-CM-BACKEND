from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "AMPL Packing POC — Admin"
admin.site.site_title = "AMPL Packing POC"
admin.site.index_title = "Administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.common.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.packing.urls")),
    path("api/v1/", include("apps.labels.urls")),
]
