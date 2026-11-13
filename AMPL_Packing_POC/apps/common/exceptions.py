"""
Error handling.

`AppError` is raised by services for business-rule failures (later milestones:
scan rejections, capacity limits, ...). `api_exception_handler` turns every
error into the standard envelope so the frontend handles one shape only.
"""
import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework import status
from rest_framework.views import exception_handler as drf_exception_handler

from .responses import error_response

logger = logging.getLogger(__name__)


class AppError(drf_exceptions.APIException):
    """A business-rule error with a stable machine-readable code."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "BAD_REQUEST"
    default_detail = "The request could not be processed."

    def __init__(self, code=None, message=None, status_code=None, extra=None):
        self.error_code = code or self.default_code
        if status_code is not None:
            self.status_code = status_code
        self.extra = extra or {}
        super().__init__(detail=message or self.default_detail, code=self.error_code)


_DRF_CODES = {
    drf_exceptions.NotAuthenticated: "NOT_AUTHENTICATED",
    drf_exceptions.AuthenticationFailed: "AUTHENTICATION_FAILED",
    drf_exceptions.PermissionDenied: "PERMISSION_DENIED",
    drf_exceptions.NotFound: "NOT_FOUND",
    drf_exceptions.MethodNotAllowed: "METHOD_NOT_ALLOWED",
    drf_exceptions.NotAcceptable: "NOT_ACCEPTABLE",
    drf_exceptions.UnsupportedMediaType: "UNSUPPORTED_MEDIA_TYPE",
    drf_exceptions.Throttled: "TOO_MANY_REQUESTS",
    drf_exceptions.ParseError: "INVALID_JSON",
}


def _flatten_validation_errors(detail, prefix=""):
    """Turn DRF's nested error dict into [{field, message}, ...]."""
    items = []
    if isinstance(detail, dict):
        for key, value in detail.items():
            field = f"{prefix}.{key}" if prefix else str(key)
            items.extend(_flatten_validation_errors(value, field))
    elif isinstance(detail, list):
        for index, value in enumerate(detail):
            if isinstance(value, (dict, list)):
                items.extend(_flatten_validation_errors(value, f"{prefix}[{index}]"))
            else:
                items.append({"field": prefix or "non_field_errors", "message": str(value)})
    else:
        items.append({"field": prefix or "non_field_errors", "message": str(detail)})
    return items


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = drf_exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = drf_exceptions.PermissionDenied()

    response = drf_exception_handler(exc, context)

    if response is None:
        # Unexpected error: log details, return a generic message.
        logger.exception("Unhandled API error", exc_info=exc)
        return error_response(
            "INTERNAL_ERROR",
            "Something went wrong on the server. Please try again.",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, AppError):
        return error_response(
            exc.error_code, str(exc.detail), status=exc.status_code, extra=exc.extra
        )

    if isinstance(exc, drf_exceptions.ValidationError):
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the highlighted fields.",
            status=response.status_code,
            errors=_flatten_validation_errors(exc.detail),
        )

    code = next(
        (value for cls, value in _DRF_CODES.items() if isinstance(exc, cls)), "ERROR"
    )
    detail = getattr(exc, "detail", None)
    message = str(detail) if detail else "Request failed."
    error = error_response(code, message, status=response.status_code)
    # Keep headers such as Retry-After / WWW-Authenticate.
    for header, value in response.items():
        error[header] = value
    return error
