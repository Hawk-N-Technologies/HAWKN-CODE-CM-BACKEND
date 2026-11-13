from django.urls import path

from . import views

app_name = "packing"

urlpatterns = [
    path("my/sections", views.MySectionsView.as_view(), name="my-sections"),
    path("sections/<int:pk>/boxes", views.StartBoxView.as_view(), name="section-start-box"),
    path("boxes/<uuid:public_id>", views.BoxDetailView.as_view(), name="box-detail"),
    path("boxes/<uuid:public_id>/scans", views.BoxScanView.as_view(), name="box-scan"),
    path("boxes/<uuid:public_id>/items/<str:uid>", views.BoxItemView.as_view(), name="box-item"),
    path("boxes/<uuid:public_id>/complete", views.BoxCompleteView.as_view(), name="box-complete"),
    path("boxes/<uuid:public_id>/cancel", views.BoxCancelView.as_view(), name="box-cancel"),
]
