"""
Small environment helpers.

Reads AMPL_Packing_POC/.env (if present) into os.environ without overriding
variables that are already set by the shell, Docker or the server. If the
same key appears twice in .env, the last line wins.
Kept dependency-free on purpose.
"""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

TRUE_VALUES = {"1", "true", "yes", "on"}


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    file_values = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        file_values[key] = value  # a later line for the same key wins
    for key, value in file_values.items():
        os.environ.setdefault(key, value)  # real environment variables still win


def env_str(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and (value is None or value == ""):
        raise ImproperlyConfigured(
            f"Environment variable {name} is required. See .env.example."
        )
    return value if value is not None else ""


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in TRUE_VALUES


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{name} must be a whole number.") from exc


def env_list(name: str, default: str = "") -> list[str]:
    value = os.environ.get(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]
