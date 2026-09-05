"""Doctor dashboard endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import RepoDep
from app.schemas.doctor import (
    DoctorAnalyticsOut,
    DoctorPatientSummaryOut,
    DoctorQueueOut,
    MarkReviewedIn,
)
from app.services.doctor_service import (
    get_analytics,
    get_patient_summary,
    get_queue,
    mark_reviewed,
)

router = APIRouter(prefix="/doctor", tags=["doctor"])


@router.get("/queue", response_model=DoctorQueueOut)
def doctor_queue(repo: RepoDep, include_reviewed: bool = False, priority: str | None = None) -> DoctorQueueOut:
    return get_queue(repo, include_reviewed=include_reviewed, priority=priority)


@router.get("/analytics", response_model=DoctorAnalyticsOut)
def doctor_analytics(repo: RepoDep) -> DoctorAnalyticsOut:
    return get_analytics(repo)


@router.get("/patients/{patient_id}/summary", response_model=DoctorPatientSummaryOut)
def doctor_patient_summary(
    patient_id: UUID, repo: RepoDep, session_id: UUID | None = None
) -> DoctorPatientSummaryOut:
    return get_patient_summary(repo, patient_id=patient_id, session_id=session_id)


@router.post("/sessions/{session_id}/reviewed")
def doctor_mark_reviewed(session_id: UUID, payload: MarkReviewedIn, repo: RepoDep) -> dict:
    return mark_reviewed(repo, session_id=session_id, payload=payload)
