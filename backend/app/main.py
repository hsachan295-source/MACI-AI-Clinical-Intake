"""MACI FastAPI application entrypoint.

Local:   uvicorn app.main:app --reload   (from the backend/ directory)
Vercel:  imported by backend/api/index.py as the ASGI `app`.

Design for serverless:
* No `lifespan` / startup hook. Nothing here touches the network, the LLM, the
  vector store or the database at import or startup time. Every integration is
  created lazily on first use (`get_repository()`, `get_vector_store()`,
  `get_groq()` ...) and each of those degrades to an offline fallback.
* `GET /` and `GET /health` are trivial and dependency-free.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger

configure_logging("DEBUG" if settings.app_debug else "INFO")
log = get_logger("main")

app = FastAPI(
    title="MACI - Multilingual AI Clinical Intake Platform",
    description=(
        "AI-assisted clinical history intake. The AI collects history and drafts "
        "a physician-ready summary - it does NOT provide a diagnosis. Prototype "
        "only; not certified for HIPAA/DPDP/ABDM."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=None if settings.cors_origin_list == ["*"] else r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)

register_exception_handlers(app)
app.include_router(api_router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    """Trivial root - never calls an external service."""
    return {
        "name": "MACI",
        "full_name": "Multilingual AI Clinical Intake Platform",
        "service": "MACI API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["health"], include_in_schema=True)
@app.get("/healthz", include_in_schema=False)
def health() -> dict:
    """Liveness probe. MUST NOT depend on Supabase, Pinecone, Groq or OCR.Space."""
    return {"status": "ok", "service": "MACI API"}


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
def _not_found(full_path: str, request: Request) -> JSONResponse:
    """Informative 404 - names the path the app actually received, which makes
    reverse-proxy / rewrite misconfiguration (e.g. on Vercel) diagnosable."""
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": "route_not_found",
                "message": f"No route for {request.method} {request.url.path}",
                "received_path": request.url.path,
                "hint": "Try /health, /api/health, /docs",
            }
        },
    )
