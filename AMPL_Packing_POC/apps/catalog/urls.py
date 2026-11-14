from django.urls import path

from . import views

app_name = "catalog"

urlpatterns = [
    path("skus", views.SkuListCreateView.as_view(), name="sku-list"),
    path("skus/<int:pk>", views.SkuDetailView.as_view(), name="sku-detail"),
    path("skus/<int:pk>/uid-batches", views.SkuUidBatchCreateView.as_view(), name="sku-uid-batch-create"),
    path("uid-batches", views.UidBatchListView.as_view(), name="uid-batch-list"),
    path("uid-batches/<int:pk>", views.UidBatchDetailView.as_view(), name="uid-batch-detail"),
    path("uid-batches/<int:pk>/export.csv", views.uid_batch_export_csv, name="uid-batch-export"),
    path("product-uids", views.ProductUidListView.as_view(), name="product-uid-list"),
    path("product-uids/<str:uid>", views.ProductUidDetailView.as_view(), name="product-uid-detail"),
    path("product-uids/<str:uid>/void", views.ProductUidVoidView.as_view(), name="product-uid-void"),
    path("uid-capacity", views.UidCapacityView.as_view(), name="uid-capacity"),
]
