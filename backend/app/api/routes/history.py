"""Adaptive history interview + summary generation endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import RepoDep
from app.schemas.interview import InterviewMessageIn, InterviewMessageOut
from app.schemas.summary import ClinicalSummaryOut, GenerateSummaryIn
from app.services.clinical_interview_service import process_turn
from app.services.summary_service import generate_summary

router = APIRouter(prefix="/history", tags=["history"])


@router.post("/message", response_model=InterviewMessageOut)
async def post_message(payload: InterviewMessageIn, repo: RepoDep) -> InterviewMessageOut:
    """One turn of the adaptive clinical-history interview."""
    return await process_turn(repo, payload)


@router.post("/generate-summary", response_model=ClinicalSummaryOut)
async def post_generate_summary(payload: GenerateSummaryIn, repo: RepoDep) -> ClinicalSummaryOut:
    """Combine interview + documents + retrieved prior records into a structured summary."""
    return await generate_summary(repo, payload)
