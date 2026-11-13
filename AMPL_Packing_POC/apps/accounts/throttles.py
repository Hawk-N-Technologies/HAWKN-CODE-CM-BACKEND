from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    """Limits login attempts per IP address (default 10 per minute)."""

    scope = "login"

    def get_rate(self):
        return getattr(settings, "AMPL_LOGIN_RATE", "10/min")

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
