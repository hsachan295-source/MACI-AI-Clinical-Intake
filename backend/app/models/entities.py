"""Canonical entity models (1:1 with DB tables)."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import (
    AlertStatus,
    ClinicalMode,
    DocumentStatus,
    DocumentType,
    Gender,
    IntakeMode,
    Language,
    MessageRole,
    SessionStatus,
    SummaryStatus,
    TriagePriority,
    utcnow,
)


class Entity(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="ignore")

    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PatientEntity(Entity):
    full_name: str
    age: int | None = None
    gender: Gender = Gender.UNDISCLOSED
    preferred_language: Language = Language.EN
    phone: str | None = None
    abha_id: str | None = None
    mrn: str | None = None


class ConsentEntity(Entity):
    patient_id: UUID
    session_id: UUID | None = None
    consent_text_version: str = "v1"
    data_processing: bool = True
    ai_assistance: bool = True
    share_with_clinician: bool = True
    channel: str = "kiosk"


class SessionEntity(Entity):
    patient_id: UUID
    language: Language = Language.EN
    mode: IntakeMode = IntakeMode.TEXT
    clinical_mode: ClinicalMode = ClinicalMode.GENERAL
    department: str | None = None
    chief_complaint: str | None = None
    status: SessionStatus = SessionStatus.CREATED
    triage_priority: TriagePriority = TriagePriority.STANDARD
    red_flag: bool = False
    question_count: int = 0
    completion_pct: int = 0
    transcript: list[dict[str, Any]] = Field(default_factory=list)
    partial_history: dict[str, Any] | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None


class InterviewMessageEntity(Entity):
    session_id: UUID
    patient_id: UUID
    role: MessageRole
    text: str
    question_index: int | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class DocumentEntity(Entity):
    session_id: UUID
    patient_id: UUID
    filename: str
    stored_path: str | None = None
    content_type: str = "application/octet-stream"
    size_bytes: int = 0
    document_type: DocumentType = DocumentType.OTHER
    status: DocumentStatus = DocumentStatus.UPLOADED
    ocr_text: str | None = None
    ocr_engine: str | None = None
    ocr_confidence: float | None = None
    structured: dict[str, Any] | None = None
    error: str | None = None
    corrected_by_user: bool = False
    indexed_in_pinecone: bool = False


class OcrResultEntity(Entity):
    document_id: UUID
    patient_id: UUID
    engine: str
    raw_text: str
    mean_confidence: float | None = None
    pages: int = 1
    payload: dict[str, Any] = Field(default_factory=dict)


class MedicationEntity(Entity):
    patient_id: UUID
    session_id: UUID | None = None
    document_id: UUID | None = None
    name: str
    dosage: str = ""
    frequency: str = ""
    route: str = ""
    duration: str = ""
    indication: str = ""
    source: str = "document"  # document | interview | summary


class AllergyEntity(Entity):
    patient_id: UUID
    session_id: UUID | None = None
    substance: str
    reaction: str = ""
    severity: str = ""
    source: str = "interview"


class LabResultEntity(Entity):
    patient_id: UUID
    session_id: UUID | None = None
    document_id: UUID | None = None
    test_name: str
    value: str = ""
    unit: str = ""
    reference_range: str = ""
    flag: str = ""
    observed_at: str = ""


class MedicalHistoryEntity(Entity):
    patient_id: UUID
    session_id: UUID
    structured: dict[str, Any] = Field(default_factory=dict)
    completeness_score: int = 0
    source: str = "interview"


class ClinicalSummaryEntity(Entity):
    session_id: UUID
    patient_id: UUID
    status: SummaryStatus = SummaryStatus.DRAFT
    narrative: str = ""
    history: dict[str, Any] = Field(default_factory=dict)
    edited_history: dict[str, Any] | None = None
    document_intelligence: list[dict[str, Any]] = Field(default_factory=list)
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    ayush_assessment: dict[str, Any] | None = None
    red_flags: list[str] = Field(default_factory=list)
    attention_points: list[str] = Field(default_factory=list)
    triage_priority: TriagePriority = TriagePriority.STANDARD
    retrieved_context: list[dict[str, Any]] = Field(default_factory=list)
    used_llm_fallback: bool = False
    model_name: str = ""
    doctor_notes: str = ""
    reviewed_by: str | None = None
    confirmed_at: datetime | None = None


class AlertEntity(Entity):
    session_id: UUID
    patient_id: UUID
    kind: str = "red_flag"
    label: str = ""
    detail: str = ""
    severity: TriagePriority = TriagePriority.URGENT
    status: AlertStatus = AlertStatus.OPEN
    source: str = "rule"
    acknowledged_by: str | None = None


class AyushAssessmentEntity(Entity):
    session_id: UUID
    patient_id: UUID
    assessment: dict[str, Any] = Field(default_factory=dict)
