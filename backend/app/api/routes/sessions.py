"""Clinical intake session endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import RepoDep
from app.api.serializers import session_out
from app.core.errors import ConsentRequiredError
from app.models.entities import SessionEntity
from app.schemas.common import SessionStatus
from app.schemas.interview import ChatTurn, InterviewStateOut
from app.schemas.session import SessionCreate, SessionOut, SessionUpdate
from app.schemas.summary import ClinicalSummaryOut, GenerateSummaryIn
from app.services.clinical_interview_service import intro_message
from app.services.summary_service import generate_summary, summary_to_out

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _has_valid_consent(repo, patient_id: UUID) -> bool:
    for c in repo.query_for_patient("consents", patient_id):
        if c.get("data_processing") and c.get("share_with_clinician"):
            return True
    return False


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, repo: RepoDep) -> SessionOut:
    repo.get_or_404("patients", payload.patient_id, label="patient")
    if not _has_valid_consent(repo, payload.patient_id):
        raise ConsentRequiredError(
            "Patient consent must be recorded before starting an intake session"
        )
    entity = SessionEntity(**payload.model_dump(), status=SessionStatus.CREATED)
    row = repo.create("clinical_sessions", entity)
    out = session_out(row)
    return out


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: UUID, repo: RepoDep) -> SessionOut:
    return session_out(repo.get_or_404("clinical_sessions", session_id, label="session"))


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(session_id: UUID, payload: SessionUpdate, repo: RepoDep) -> SessionOut:
    repo.get_or_404("clinical_sessions", session_id, label="session")
    patch = payload.model_dump(exclude_none=True)
    row = repo.update("clinical_sessions", session_id, patch) if patch else repo.get("clinical_sessions", session_id)
    return session_out(row)


@router.get("/{session_id}/intro")
def session_intro(session_id: UUID, repo: RepoDep) -> dict:
    row = repo.get_or_404("clinical_sessions", session_id, label="session")
    return {
        "session_id": str(session_id),
        "message": intro_message(row.get("language", "en"), row.get("chief_complaint") or ""),
        "disclaimer": "This assistant records your history for the doctor. It does not diagnose.",
    }


@router.get("/{session_id}/interview", response_model=InterviewStateOut)
def get_interview_state(session_id: UUID, repo: RepoDep) -> InterviewStateOut:
    row = repo.get_or_404("clinical_sessions", session_id, label="session")
    transcript = [
        ChatTurn(role=t.get("role", "patient"), text=t.get("text", ""))
        for t in (row.get("transcript") or [])
    ]
    return InterviewStateOut(
        session_id=session_id,
        transcript=transcript,
        question_count=int(row.get("question_count") or 0),
        completion_pct=int(row.get("completion_pct") or 0),
        is_complete=row.get("status") in (
            SessionStatus.AWAITING_DOCUMENTS.value,
            SessionStatus.SUMMARY_READY.value,
            SessionStatus.SUBMITTED.value,
            SessionStatus.REVIEWED.value,
        ),
        partial_history=row.get("partial_history"),
    )


@router.post("/{session_id}/submit", response_model=SessionOut)
async def submit_session(session_id: UUID, repo: RepoDep) -> SessionOut:
    row = repo.get_or_404("clinical_sessions", session_id, label="session")
    if not repo.summary_for_session(session_id):
        await generate_summary(
            repo, GenerateSummaryIn(session_id=session_id, patient_id=row["patient_id"])
        )
    updated = repo.update(
        "clinical_sessions",
        session_id,
        {
            "status": SessionStatus.SUBMITTED.value,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return session_out(updated)


@router.get("/{session_id}/summary", response_model=ClinicalSummaryOut)
def get_session_summary(session_id: UUID, repo: RepoDep) -> ClinicalSummaryOut:
    repo.get_or_404("clinical_sessions", session_id, label="session")
    row = repo.summary_for_session(session_id)
    if not row:
        from app.core.errors import NotFoundError

        raise NotFoundError("No summary generated for this session yet")
    return summary_to_out(row)
