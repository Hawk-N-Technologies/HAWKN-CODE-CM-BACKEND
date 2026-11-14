from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("dashboard/summary", views.DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("boxes", views.PackingHistoryView.as_view(), name="packing-history"),
    path("scan-logs", views.ScanLogView.as_view(), name="scan-logs"),
]
