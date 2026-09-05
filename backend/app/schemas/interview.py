"""Adaptive interview message / turn schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.clinical_history import StructuredClinicalHistory
from app.schemas.common import ApiModel, Language, MessageRole, utcnow
from app.schemas.triage import TriageResult


class InterviewMessageIn(ApiModel):
    session_id: UUID
    patient_id: UUID
    text: str = Field(min_length=1, max_length=4000)
    language: Language | None = None
    # Optional client hint that the patient wants to finish the interview.
    request_complete: bool = False


class ChatTurn(ApiModel):
    role: MessageRole
    text: str
    created_at: datetime = Field(default_factory=utcnow)


class InterviewMessageOut(ApiModel):
    session_id: UUID
    assistant_message: str
    next_question: str | None = None
    is_complete: bool = False
    question_count: int = 0
    completion_pct: int = 0
    suggested_replies: list[str] = Field(default_factory=list)
    triage: TriageResult
    disclaimer: str = (
        "This assistant collects your history for the doctor. It does not provide a diagnosis."
    )
    partial_history: StructuredClinicalHistory | None = None


class InterviewStateOut(ApiModel):
    session_id: UUID
    transcript: list[ChatTurn] = Field(default_factory=list)
    question_count: int = 0
    completion_pct: int = 0
    is_complete: bool = False
    partial_history: StructuredClinicalHistory | None = None
