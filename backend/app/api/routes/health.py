"""Health + capability probe. Never returns secret values."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import RepoDep
from app.core.config import settings
from app.services.embedding_service import get_embedder
from app.services.pinecone_service import get_vector_store

router = APIRouter(tags=["health"])


@router.get("/health")
def health(repo: RepoDep) -> dict:
    embedder = get_embedder()
    return {
        "status": "ok",
        "app": "MACI - Multilingual AI Clinical Intake Platform",
        "env": settings.app_env,
        "version": "0.1.0",
        "integrations": settings.integration_status(),  # booleans only
        "runtime": {
            "repository": repo.backend,
            "vector_store": get_vector_store().backend,
            "embedder": embedder.name,
            "embedding_dimension": embedder.dimension,
            "llm_model": settings.groq_model if settings.groq_enabled else None,
        },
        "notes": (
            "Missing integrations fall back to deterministic offline behaviour. "
            "This prototype is NOT certified for HIPAA/DPDP/ABDM; production "
            "deployment requires a formal security & compliance review."
        ),
    }


@router.get("/healthz", include_in_schema=False)
def healthz() -> dict:
    return {"status": "ok"}
