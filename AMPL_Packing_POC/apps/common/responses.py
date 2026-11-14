"""
Standard response envelope, matching the HawkN convention:

    success: {"success": true,  "data": ..., "message": "..."}
    error:   {"success": false, "code": "SOME_CODE", "message": "...", "errors": [...]}
"""
from rest_framework.response import Response


def success_response(data=None, message=None, status=200):
    body = {"success": True, "data": data}
    if message:
        body["message"] = message
    return Response(body, status=status)


def error_response(code, message, status=400, errors=None, extra=None):
    body = {"success": False, "code": code, "message": message}
    if errors:
        body["errors"] = errors
    if extra:
        body.update(extra)
    return Response(body, status=status)
