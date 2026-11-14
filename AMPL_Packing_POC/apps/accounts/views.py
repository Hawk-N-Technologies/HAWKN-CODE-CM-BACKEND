import logging

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.common.exceptions import AppError
from apps.common.responses import success_response

from .authentication import SessionAuthentication
from .serializers import LoginSerializer, user_payload
from .throttles import LoginRateThrottle

logger = logging.getLogger(__name__)


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    """GET /api/v1/auth/csrf - sets the ampl_csrftoken cookie."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return success_response({"csrf": "set", "csrfToken": get_token(request)})


class LoginView(APIView):
    """POST /api/v1/auth/login {username, password}"""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        # Login is not authenticated yet, so check CSRF explicitly.
        SessionAuthentication().enforce_csrf(request)

        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None or not (user.is_ampl_admin or user.is_ampl_operator):
            logger.info("Failed login for %s", serializer.validated_data["username"])
            raise AppError(
                "INVALID_CREDENTIALS",
                "Wrong username or password.",
                status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        logger.info("User %s logged in", user.username)
        return success_response(user_payload(user), message="Logged in.")


class LogoutView(APIView):
    """POST /api/v1/auth/logout"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return success_response(None, message="Logged out.")


class MeView(APIView):
    """GET /api/v1/auth/me - the logged-in user, role and sections."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(user_payload(request.user))
