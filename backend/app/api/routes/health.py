"""Health + capability probe.

``GET /api/health`` is deliberately trivial: it MUST NOT touch Supabase,
Pinecone, Groq, OCR.Space, the embedder or the filesystem, so it always returns
200 even when every integration is down or misconfigured.

``GET /api/health/details`` is the richer capability probe; every optional
lookup in it is guarded so it also never 500s.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])

_NOTES = (
    "Missing integrations fall back to deterministic offline behaviour. "
    "This prototype is NOT certified for HIPAA/DPDP/ABDM; production "
    "deployment requires a formal security & compliance review."
)


@router.get("/health")
def health() -> dict:
    """Liveness probe - no external dependencies."""
    return {"status": "ok", "service": "MACI API"}


@router.get("/healthz", include_in_schema=False)
def healthz() -> dict:
    return {"status": "ok", "service": "MACI API"}


@router.get("/health/details")
def health_details() -> dict:
    """Capability probe. Every optional lookup is guarded - never raises."""
    try:
        integrations = settings.integration_status()  # booleans only
    except Exception:  # pragma: no cover - defensive
        integrations = {"groq": False, "ocr_space": False, "pinecone": False, "supabase": False}

    runtime: dict = {"repository": "unknown", "vector_store": "unknown", "embedder": "unknown"}
    try:
        from app.repositories import get_repository

        runtime["repository"] = get_repository().backend
    except Exception as exc:  # pragma: no cover - defensive
        runtime["repository_error"] = type(exc).__name__
    try:
        from app.services.pinecone_service import get_vector_store

        runtime["vector_store"] = get_vector_store().backend
    except Exception as exc:  # pragma: no cover - defensive
        runtime["vector_store_error"] = type(exc).__name__
    try:
        from app.services.embedding_service import get_embedder

        emb = get_embedder()
        runtime["embedder"] = emb.name
        runtime["embedding_dimension"] = emb.dimension
    except Exception as exc:  # pragma: no cover - defensive
        runtime["embedder_error"] = type(exc).__name__

    runtime["llm_model"] = settings.groq_model if integrations.get("groq") else None

    return {
        "status": "ok",
        "app": "MACI - Multilingual AI Clinical Intake Platform",
        "env": settings.app_env,
        "version": "0.1.0",
        "serverless": settings.is_serverless,
        "integrations": integrations,
        "runtime": runtime,
        "notes": _NOTES,
    }
