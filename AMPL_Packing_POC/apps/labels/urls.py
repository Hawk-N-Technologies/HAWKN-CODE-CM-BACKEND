from django.urls import path

from . import views

app_name = "labels"

urlpatterns = [
    path("product-uids/<str:uid>/qr.svg", views.product_qr_svg, name="product-qr"),
    path("boxes/<str:box_uid>/qr.svg", views.box_qr_svg, name="box-qr"),
    path("uid-batches/<int:pk>/labels", views.BatchLabelsView.as_view(), name="batch-labels"),
    path("boxes/<uuid:public_id>/label", views.BoxLabelView.as_view(), name="box-label"),
]
