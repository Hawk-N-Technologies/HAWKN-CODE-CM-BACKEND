from rest_framework import authentication


class SessionAuthentication(authentication.SessionAuthentication):
    """
    Same as DRF's session authentication, but "not logged in" is answered
    with 401 (instead of 403) so the frontend can tell "please log in"
    apart from "not allowed". "Session" is not a scheme browsers show a
    password pop-up for.
    """

    def authenticate_header(self, request):
        return "Session"
