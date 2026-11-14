from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


class HealthEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_is_public_and_reports_database_ok(self):
        response = self.client.get("/api/v1/health")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["api"], "ok")
        self.assertEqual(body["data"]["database"], "ok")

    def test_unknown_api_route_returns_404(self):
        response = self.client.get("/api/v1/does-not-exist")
        self.assertEqual(response.status_code, 404)


class UserModelTests(TestCase):
    def test_superuser_is_always_admin_role(self):
        user = User.objects.create_superuser("root", password="a-long-test-password")
        self.assertEqual(user.role, User.Role.ADMIN)

    def test_regular_user_defaults_to_operator(self):
        user = User.objects.create_user("op1", password="a-long-test-password")
        self.assertEqual(user.role, User.Role.OPERATOR)
        self.assertEqual(User._meta.db_table, "ampl_user")
