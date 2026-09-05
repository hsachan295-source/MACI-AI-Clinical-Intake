"""AYUSH / Ayurveda assessment endpoints (optional mode, kept separate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import RepoDep
from app.core.errors import NotFoundError
from app.models.entities import AyushAssessmentEntity
from app.schemas.ayush import AyushAssessment, AyushAssessmentIn, AyushAssessmentOut

router = APIRouter(prefix="/ayush", tags=["ayush"])


def _out(row: dict) -> AyushAssessmentOut:
    return AyushAssessmentOut(
        id=row["id"],
        session_id=row["session_id"],
        patient_id=row["patient_id"],
        assessment=AyushAssessment.model_validate(row.get("assessment") or {}),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


@router.post("/assessment", response_model=AyushAssessmentOut, status_code=status.HTTP_201_CREATED)
def upsert_assessment(payload: AyushAssessmentIn, repo: RepoDep) -> AyushAssessmentOut:
    session = repo.get_or_404("clinical_sessions", payload.session_id, label="session")
    repo.ensure_owned(session, payload.patient_id, table="clinical_sessions")

    existing = repo.query("ayush_assessments", session_id=str(payload.session_id))
    data = {"assessment": payload.assessment.model_dump(mode="json")}
    if existing:
        row = repo.update("ayush_assessments", existing[-1]["id"], data)
    else:
        row = repo.create(
            "ayush_assessments",
            AyushAssessmentEntity(
                session_id=payload.session_id,
                patient_id=payload.patient_id,
                assessment=payload.assessment.model_dump(mode="json"),
            ),
        )
    return _out(row)


@router.get("/assessment/{session_id}", response_model=AyushAssessmentOut)
def get_assessment(session_id: UUID, repo: RepoDep) -> AyushAssessmentOut:
    rows = repo.query("ayush_assessments", session_id=str(session_id))
    if not rows:
        raise NotFoundError("No AYUSH assessment recorded for this session")
    return _out(rows[-1])
