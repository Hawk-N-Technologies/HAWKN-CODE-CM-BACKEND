import logging
import time

from django.conf import settings
from django.db import DatabaseError, connection
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .responses import error_response, success_response

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """
    GET /api/v1/health

    Public. Confirms the API is running and can reach its database.
    Deliberately reveals no host names, database names or versions of
    third-party software.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        started = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except DatabaseError:
            logger.exception("Health check: database unreachable")
            return error_response(
                "DATABASE_UNAVAILABLE",
                "The API is running but cannot reach its database.",
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                extra={"data": {"api": "ok", "database": "unavailable"}},
            )

        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        return success_response(
            {
                "service": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "api": "ok",
                "database": "ok",
                "database_latency_ms": latency_ms,
                "server_time": timezone.now().isoformat(),
            }
        )
