"""Test configuration.

CRITICAL: no test may consume real API quota. Before *any* app module is
imported we make the config hermetic:

* ``MACI_DISABLE_DOTENV=1`` so the developer's local ``.env`` is never read.
* Every integration key is *removed* from the environment (not blanked - blanks
  are now ignored by ``env_ignore_empty``), forcing every service onto its
  deterministic offline fallback.

External clients are also monkeypatched defensively.
"""
from __future__ import annotations

import os
import tempfile

# --- 1. hermetic + offline config BEFORE importing the app -----------------
_TMP = tempfile.mkdtemp(prefix="maci-test-")

# Remove every integration secret (and all its aliases) so it is genuinely absent.
for _var in (
    "GROQ_API_KEY", "OCR_SPACE_API_KEY", "OCR_SPACE_API_URL",
    "PINECONE_API_KEY", "PINECONE_HOST",
    "SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_KEY",
    "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
):
    os.environ.pop(_var, None)

os.environ.update(
    {
        "MACI_DISABLE_DOTENV": "1",
        "APP_ENV": "test",
        "APP_DEBUG": "false",
        "EMBEDDING_PROVIDER": "hash",
        "EMBEDDING_DIMENSION": "128",
        "PINECONE_DIMENSION": "128",
        "UPLOAD_DIR": os.path.join(_TMP, "uploads"),
        "MAX_UPLOAD_MB": "5",
        "MAX_INTERVIEW_QUESTIONS": "8",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.repositories import get_repository  # noqa: E402
from app.services.pinecone_service import reset_vector_store  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_state(monkeypatch):
    """Fresh in-memory repo + vector store for every test."""
    get_settings.cache_clear()
    get_repository.cache_clear()
    reset_vector_store()
    repo = get_repository()
    if hasattr(repo, "clear"):
        repo.clear()

    # Defensive: make any accidental Groq call fail loudly instead of hitting network.
    async def _boom(*_a, **_k):  # pragma: no cover
        raise AssertionError("A test attempted a real Groq call")

    monkeypatch.setattr("app.services.groq_service.GroqService._chat_completion", _boom, raising=True)
    yield
    reset_vector_store()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def repo():
    return get_repository()


# --------------------------------------------------------------------------- #
# Factories
# --------------------------------------------------------------------------- #
@pytest.fixture
def make_patient(client):
    def _make(**over):
        body = {"full_name": "Asha Rao", "age": 54, "gender": "female", "preferred_language": "en"}
        body.update(over)
        r = client.post("/api/patients", json=body)
        assert r.status_code == 201, r.text
        return r.json()

    return _make


@pytest.fixture
def give_consent(client):
    def _consent(patient_id: str):
        r = client.post(
            f"/api/patients/{patient_id}/consent",
            json={
                "patient_id": patient_id,
                "data_processing": True,
                "ai_assistance": True,
                "share_with_clinician": True,
            },
        )
        assert r.status_code == 201, r.text
        return r.json()

    return _consent


@pytest.fixture
def make_session(client, give_consent):
    def _make(patient_id: str, **over):
        give_consent(patient_id)
        body = {"patient_id": patient_id, "language": "en", "mode": "text", "clinical_mode": "general"}
        body.update(over)
        r = client.post("/api/sessions", json=body)
        assert r.status_code == 201, r.text
        return r.json()

    return _make
