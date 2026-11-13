from rest_framework.permissions import BasePermission


def _active(user) -> bool:
    return bool(user and user.is_authenticated and user.is_active)


class IsAmplAdmin(BasePermission):
    message = "Only an AMPL admin can do this."

    def has_permission(self, request, view):
        return _active(request.user) and getattr(request.user, "is_ampl_admin", False)


class IsAmplUser(BasePermission):
    """Any active AMPL admin or operator."""

    message = "You do not have access to AMPL Packing."

    def has_permission(self, request, view):
        user = request.user
        return _active(user) and (
            getattr(user, "is_ampl_admin", False) or getattr(user, "is_ampl_operator", False)
        )
