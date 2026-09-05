"""Doctor dashboard schemas (queue + analytics)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.ayush import AyushAssessment
from app.schemas.common import ApiModel, SessionStatus, TriagePriority
from app.schemas.document import DocumentOut
from app.schemas.summary import ClinicalSummaryOut
from app.schemas.timeline import TimelineEvent


class QueueItem(ApiModel):
    session_id: UUID
    patient_id: UUID
    patient_name: str
    age: int | None = None
    gender: str = "undisclosed"
    language: str = "en"
    clinical_mode: str = "general"
    chief_complaint: str = ""
    status: str = SessionStatus.SUBMITTED.value
    triage_priority: str = TriagePriority.STANDARD.value
    red_flag: bool = False
    completion_pct: int = 0
    has_summary: bool = False
    summary_status: str | None = None
    submitted_at: datetime | None = None
    waiting_minutes: int = 0
    created_at: datetime | None = None


class DoctorQueueOut(ApiModel):
    items: list[QueueItem] = Field(default_factory=list)
    total: int = 0


class PatientOverview(ApiModel):
    patient_id: UUID
    full_name: str
    age: int | None = None
    gender: str = "undisclosed"
    preferred_language: str = "en"
    chief_complaint: str = ""
    abha_id: str | None = None
    mrn: str | None = None


class DoctorPatientSummaryOut(ApiModel):
    overview: PatientOverview
    session_id: UUID
    session_status: str
    triage_priority: str
    red_flag: bool
    summary: ClinicalSummaryOut | None = None
    documents: list[DocumentOut] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)
    ayush_assessment: AyushAssessment | None = None
    transcript_available: bool = False


class AnalyticsBucket(ApiModel):
    label: str
    value: int


class DoctorAnalyticsOut(ApiModel):
    patients_today: int = 0
    waiting: int = 0
    high_priority: int = 0
    completed_intake: int = 0
    reviewed_today: int = 0
    average_intake_minutes: float = 0.0
    by_complaint_category: list[AnalyticsBucket] = Field(default_factory=list)
    by_priority: list[AnalyticsBucket] = Field(default_factory=list)
    intake_activity_by_hour: list[AnalyticsBucket] = Field(default_factory=list)


class MarkReviewedIn(ApiModel):
    reviewed_by: str = Field(min_length=1, max_length=160)
    notes: str = ""
