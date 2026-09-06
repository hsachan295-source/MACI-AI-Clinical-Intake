"""Regression tests for the Vercel crash: blank ('') env vars for typed fields.

Production symptom (Vercel runtime logs):
    ValidationError for Settings
    app_debug   Input should be a valid boolean  input_value=''
    api_port    Input should be a valid integer  input_value=''
    ...
-> raised inside ``settings = get_settings()`` -> ``app.core.config`` import
-> ``app.main`` import fails -> FUNCTION_INVOCATION_FAILED on every route.

The fix: ``env_ignore_empty=True`` + a ``model_validator`` that drops blank
strings, so every typed field falls back to its default.

Tests use ``Settings(_env_file=None)`` to reproduce the Vercel environment
(no ``.env`` file on disk), since the local dev checkout has a real ``.env``.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from app.core.config import Settings

BACKEND_DIR = Path(__file__).resolve().parents[1]

# The exact variables from the production traceback.
BLANK_TYPED_VARS = [
    "APP_DEBUG",
    "API_PORT",
    "PINECONE_DIMENSION",
    "EMBEDDING_DIMENSION",
    "MAX_UPLOAD_MB",
    "MAX_INTERVIEW_QUESTIONS",
    "LLM_MAX_RETRIES",
]

BLANK_OPTIONAL_SECRETS = [
    "GROQ_API_KEY",
    "OCR_SPACE_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_HOST",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
]

EXPECTED_DEFAULTS = {
    "app_debug": False,
    "api_port": 8000,
    "pinecone_dimension": 384,
    "embedding_dimension": 384,
    "max_upload_mb": 10,
    "max_interview_questions": 20,
    "llm_max_retries": 3,
}


def _blank_all(monkeypatch) -> None:
    for var in BLANK_TYPED_VARS + BLANK_OPTIONAL_SECRETS + ["CORS_ORIGINS", "GROQ_MODEL", "APP_ENV"]:
        monkeypatch.setenv(var, "")


def test_blank_typed_env_vars_do_not_crash_settings(monkeypatch):
    """The original crash: Settings() must construct, not raise ValidationError."""
    _blank_all(monkeypatch)
    settings = Settings(_env_file=None)  # _env_file=None == "no .env on disk" (Vercel)
    assert settings is not None


def test_blank_typed_env_vars_fall_back_to_defaults(monkeypatch):
    _blank_all(monkeypatch)
    settings = Settings(_env_file=None)
    for field, expected in EXPECTED_DEFAULTS.items():
        assert getattr(settings, field) == expected, field
    assert settings.cors_origins == "*"
    assert settings.groq_model == "openai/gpt-oss-20b"


@pytest.mark.parametrize("var", BLANK_TYPED_VARS)
def test_each_blank_typed_var_individually(monkeypatch, var):
    monkeypatch.setenv(var, "")
    settings = Settings(_env_file=None)
    field = var.lower()
    assert getattr(settings, field) == EXPECTED_DEFAULTS[field]


def test_blank_optional_secret_disables_only_that_integration(monkeypatch):
    _blank_all(monkeypatch)
    settings = Settings(_env_file=None)
    assert settings.groq_api_key is None
    assert settings.groq_enabled is False
    assert settings.ocr_enabled is False
    assert settings.pinecone_enabled is False
    assert settings.supabase_enabled is False
    # integration_status() must still work and report all-False
    assert settings.integration_status() == {
        "groq": False, "ocr_space": False, "pinecone": False, "supabase": False
    }


def test_valid_env_values_still_parse(monkeypatch):
    monkeypatch.setenv("API_PORT", "9100")
    monkeypatch.setenv("APP_DEBUG", "true")
    monkeypatch.setenv("MAX_INTERVIEW_QUESTIONS", "5")
    monkeypatch.setenv("LLM_MAX_RETRIES", "1")
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_abc")
    settings = Settings(_env_file=None)
    assert settings.api_port == 9100
    assert settings.app_debug is True
    assert settings.max_interview_questions == 5
    assert settings.llm_max_retries == 1
    assert settings.supabase_enabled is True
    assert settings.supabase_key == "sb_publishable_abc"  # alias resolved


def test_whitespace_only_env_var_is_also_ignored(monkeypatch):
    monkeypatch.setenv("API_PORT", "   ")
    settings = Settings(_env_file=None)
    assert settings.api_port == 8000


def test_app_main_imports_in_subprocess_with_blank_env(monkeypatch):
    """`python -c "from app.main import app; print('IMPORT_OK')"` must succeed."""
    import os as _os

    env = {
        "PATH": _os.environ.get("PATH", ""),
        "SYSTEMROOT": _os.environ.get("SYSTEMROOT", ""),
        "TEMP": _os.environ.get("TEMP", _os.environ.get("TMP", "")),
        # Faithfully reproduce Vercel: no .env on disk + defined-but-blank vars.
        "VERCEL": "1",
        "MACI_DISABLE_DOTENV": "1",
    }
    for var in BLANK_TYPED_VARS + BLANK_OPTIONAL_SECRETS:
        env[var] = ""
    result = subprocess.run(
        [sys.executable, "-c", "from app.main import app; print('IMPORT_OK', len(app.routes))"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"stdout={result.stdout!r} stderr={result.stderr!r}"
    assert "IMPORT_OK" in result.stdout
