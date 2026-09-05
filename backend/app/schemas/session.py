"""Clinical intake session schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import (
    ApiModel,
    ClinicalMode,
    IntakeMode,
    Language,
    SessionStatus,
    TriagePriority,
    utcnow,
)


class SessionCreate(ApiModel):
    patient_id: UUID
    language: Language = Language.EN
    mode: IntakeMode = IntakeMode.TEXT
    clinical_mode: ClinicalMode = ClinicalMode.GENERAL
    department: str | None = Field(default=None, max_length=80)
    chief_complaint: str | None = Field(default=None, max_length=2000)


class SessionUpdate(ApiModel):
    language: Language | None = None
    mode: IntakeMode | None = None
    clinical_mode: ClinicalMode | None = None
    department: str | None = None
    chief_complaint: str | None = None
    status: SessionStatus | None = None


class SessionOut(ApiModel):
    id: UUID
    patient_id: UUID
    language: str = Language.EN.value
    mode: str = IntakeMode.TEXT.value
    clinical_mode: str = ClinicalMode.GENERAL.value
    department: str | None = None
    chief_complaint: str | None = None
    status: str = SessionStatus.CREATED.value
    triage_priority: str = TriagePriority.STANDARD.value
    red_flag: bool = False
    question_count: int = 0
    completion_pct: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
