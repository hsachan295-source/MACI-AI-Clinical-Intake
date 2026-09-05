"""Physician-ready clinical summary schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.ayush import AyushAssessment
from app.schemas.clinical_history import StructuredClinicalHistory
from app.schemas.common import ApiModel, SummaryStatus, TriagePriority, utcnow
from app.schemas.document import StructuredDocument
from app.schemas.timeline import TimelineEvent


AI_DRAFT_DISCLAIMER = "AI-generated draft. Requires clinician review."


class RetrievedContext(ApiModel):
    """A chunk retrieved from Pinecone for RAG grounding."""

    chunk_id: str
    score: float
    text: str
    source: str = ""
    metadata: dict = Field(default_factory=dict)


class GenerateSummaryIn(ApiModel):
    session_id: UUID
    patient_id: UUID
    include_documents: bool = True
    include_rag: bool = True


class ClinicalSummaryOut(ApiModel):
    id: UUID
    session_id: UUID
    patient_id: UUID
    status: str = SummaryStatus.DRAFT.value
    disclaimer: str = AI_DRAFT_DISCLAIMER

    # Narrative + structured views
    narrative: str = ""
    history: StructuredClinicalHistory
    document_intelligence: list[StructuredDocument] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)
    ayush_assessment: AyushAssessment | None = None

    red_flags: list[str] = Field(default_factory=list)
    attention_points: list[str] = Field(default_factory=list)
    triage_priority: str = TriagePriority.STANDARD.value

    retrieved_context: list[RetrievedContext] = Field(default_factory=list)
    used_llm_fallback: bool = False
    model_name: str = ""

    doctor_notes: str = ""
    edited_history: StructuredClinicalHistory | None = None
    reviewed_by: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    confirmed_at: datetime | None = None


class SummaryPatch(ApiModel):
    narrative: str | None = None
    history: StructuredClinicalHistory | None = None
    edited_history: StructuredClinicalHistory | None = None
    attention_points: list[str] | None = None
    red_flags: list[str] | None = None
    triage_priority: TriagePriority | None = None
    doctor_notes: str | None = None
    status: SummaryStatus | None = None


class SummaryConfirmIn(ApiModel):
    reviewed_by: str = Field(min_length=1, max_length=160)
    doctor_notes: str = ""
    accept_history: bool = True
