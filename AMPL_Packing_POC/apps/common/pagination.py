from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "success": True,
                "data": data,
                "pagination": {
                    "page": self.page.number,
                    "page_size": self.get_page_size(self.request),
                    "total_items": self.page.paginator.count,
                    "total_pages": self.page.paginator.num_pages,
                },
            }
        )
