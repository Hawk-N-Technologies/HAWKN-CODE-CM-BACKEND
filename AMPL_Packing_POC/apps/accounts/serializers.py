from rest_framework import serializers

from apps.packing.models import PackingSection


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


def sections_for(user):
    """Sections a user may pack in: all active ones for admins, assigned ones for operators."""
    qs = PackingSection.objects.filter(is_active=True).select_related(
        "active_config_version", "active_config_version__configuration"
    )
    if not getattr(user, "is_ampl_admin", False):
        qs = qs.filter(operator_assignments__user=user)
    return qs.order_by("code").distinct()


def user_payload(user) -> dict:
    return {
        "id": user.pk,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": user.get_full_name() or user.username,
        "role": user.role,
        "sections": [
            {
                "id": section.pk,
                "code": section.code,
                "name": section.name,
                "active_config": str(section.active_config_version)
                if section.active_config_version
                else None,
            }
            for section in sections_for(user)
        ],
    }
