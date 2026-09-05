"""Aggregate API router mounted at /api."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    abdm,
    ayush,
    doctor,
    documents,
    health,
    history,
    patients,
    sessions,
    summaries,
    triage,
    voice,
)

api_router = APIRouter(prefix="/api")
for module in (
    health,
    patients,
    sessions,
    history,
    voice,
    documents,
    triage,
    doctor,
    summaries,
    ayush,
    abdm,
):
    api_router.include_router(module.router)
