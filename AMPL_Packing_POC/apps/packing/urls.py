from django.urls import path

from . import admin_views, views

app_name = "packing"

urlpatterns = [
    path("my/sections", views.MySectionsView.as_view(), name="my-sections"),
    # Admin screens
    path("box-configurations", admin_views.ConfigurationListView.as_view(), name="config-list"),
    path("box-configurations/<int:pk>", admin_views.ConfigurationDetailView.as_view(), name="config-detail"),
    path("box-configurations/<int:pk>/versions", admin_views.ConfigurationVersionView.as_view(), name="config-versions"),
    path("sections", admin_views.SectionListView.as_view(), name="section-list"),
    path("sections/<int:pk>", admin_views.SectionDetailView.as_view(), name="section-detail"),
    path("sections/<int:pk>/operators", admin_views.SectionOperatorsView.as_view(), name="section-operators"),
    path("sections/<int:pk>/operators/<int:user_id>", admin_views.SectionOperatorDetailView.as_view(), name="section-operator-detail"),
    path("sections/<int:pk>/boxes", views.StartBoxView.as_view(), name="section-start-box"),
    path("boxes/lookup", views.BoxLookupView.as_view(), name="box-lookup"),
    path("boxes/<uuid:public_id>", views.BoxDetailView.as_view(), name="box-detail"),
    path("boxes/<uuid:public_id>/scans", views.BoxScanView.as_view(), name="box-scan"),
    path("boxes/<uuid:public_id>/items/<str:uid>", views.BoxItemView.as_view(), name="box-item"),
    path("boxes/<uuid:public_id>/complete", views.BoxCompleteView.as_view(), name="box-complete"),
    path("boxes/<uuid:public_id>/cancel", views.BoxCancelView.as_view(), name="box-cancel"),
    path("boxes/<uuid:public_id>/verifications", views.BoxVerificationView.as_view(), name="box-verifications"),
]
