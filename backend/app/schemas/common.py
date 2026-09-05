"""Shared enums and base models."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ApiModel(BaseModel):
    """Base model: ignores unknown keys on input, serialises enums by value."""

    model_config = ConfigDict(use_enum_values=True, extra="ignore", populate_by_name=True)


class Language(str, Enum):
    EN = "en"
    HI = "hi"


class IntakeMode(str, Enum):
    VOICE = "voice"
    TEXT = "text"


class ClinicalMode(str, Enum):
    GENERAL = "general"
    AYUSH = "ayush"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNDISCLOSED = "undisclosed"


class SessionStatus(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    AWAITING_DOCUMENTS = "awaiting_documents"
    SUMMARY_READY = "summary_ready"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    CANCELLED = "cancelled"


class TriagePriority(str, Enum):
    ROUTINE = "routine"
    STANDARD = "standard"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class DocumentType(str, Enum):
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    DISCHARGE_SUMMARY = "discharge_summary"
    IMAGING_REPORT = "imaging_report"
    REFERRAL = "referral"
    OTHER = "other"


class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    OCR_RUNNING = "ocr_running"
    OCR_DONE = "ocr_done"
    STRUCTURED = "structured"
    FAILED = "failed"


class SummaryStatus(str, Enum):
    DRAFT = "draft"
    EDITED = "edited"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class AlertStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class MessageRole(str, Enum):
    PATIENT = "patient"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class IdMixin(ApiModel):
    id: UUID = Field(default_factory=uuid4)


class TimestampMixin(ApiModel):
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
