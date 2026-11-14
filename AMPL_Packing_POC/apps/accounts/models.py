"""
Custom user model.

Defined in M0 on purpose: Django's user model must be decided before the
first migration and is very hard to change afterwards.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        OPERATOR = "OPERATOR", "Operator"

    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.OPERATOR,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ampl_user"
        ordering = ["username"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(role__in=["ADMIN", "OPERATOR"]),
                name="ampl_user_role_valid",
            ),
        ]

    def save(self, *args, **kwargs):
        # A Django superuser is always an AMPL admin.
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    @property
    def is_ampl_admin(self) -> bool:
        return self.is_active and self.role == self.Role.ADMIN

    @property
    def is_ampl_operator(self) -> bool:
        return self.is_active and self.role == self.Role.OPERATOR

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})"
