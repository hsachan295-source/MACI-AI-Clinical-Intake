"""MACI FastAPI application entrypoint.

Run:  uvicorn app.main:app --reload   (from the backend/ directory)
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger

configure_logging("DEBUG" if settings.app_debug else "INFO")
log = get_logger("main")


@asynccontextmanager
async def lifespan(_: FastAPI):
    status = settings.integration_status()
    log.info(
        "MACI starting | env=%s | integrations: %s",
        settings.app_env,
        ", ".join(f"{k}={'on' if v else 'off (fallback)'}" for k, v in status.items()),
    )
    # Touch the repository/vector store so their backend choice is logged now.
    from app.repositories import get_repository
    from app.services.pinecone_service import get_vector_store

    get_repository()
    get_vector_store()
    yield
    log.info("MACI shutting down")


app = FastAPI(
    title="MACI - Multilingual AI Clinical Intake Platform",
    description=(
        "AI-assisted clinical history intake. The AI collects history and drafts "
        "a physician-ready summary - it does NOT provide a diagnosis. Prototype "
        "only; not certified for HIPAA/DPDP/ABDM."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)

register_exception_handlers(app)
app.include_router(api_router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "name": "MACI",
        "full_name": "Multilingual AI Clinical Intake Platform",
        "docs": "/docs",
        "health": "/api/health",
    }
