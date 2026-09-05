"""Patient + consent schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import ApiModel, Gender, Language, utcnow


class PatientCreate(ApiModel):
    full_name: str = Field(min_length=1, max_length=160)
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender = Gender.UNDISCLOSED
    preferred_language: Language = Language.EN
    phone: str | None = Field(default=None, max_length=32)
    abha_id: str | None = Field(default=None, max_length=64, description="Optional ABHA / ABDM id (not verified in prototype)")
    mrn: str | None = Field(default=None, max_length=64, description="Hospital medical record number")

    @field_validator("full_name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("full_name cannot be blank")
        return v

    @field_validator("phone")
    @classmethod
    def _clean_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None


class PatientUpdate(ApiModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender | None = None
    preferred_language: Language | None = None
    phone: str | None = None
    abha_id: str | None = None
    mrn: str | None = None


class PatientOut(ApiModel):
    id: UUID
    full_name: str
    age: int | None = None
    gender: str = Gender.UNDISCLOSED.value
    preferred_language: str = Language.EN.value
    phone: str | None = None
    abha_id: str | None = None
    mrn: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ConsentCreate(ApiModel):
    patient_id: UUID
    session_id: UUID | None = None
    consent_text_version: str = "v1"
    data_processing: bool = Field(description="Consent to process the intake data")
    ai_assistance: bool = Field(description="Consent to AI-assisted history taking")
    share_with_clinician: bool = Field(description="Consent to share the summary with the treating clinician")
    channel: str = "kiosk"

    @field_validator("data_processing", "share_with_clinician")
    @classmethod
    def _must_consent(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("This consent is required to proceed with intake")
        return v


class ConsentOut(ApiModel):
    id: UUID
    patient_id: UUID
    session_id: UUID | None = None
    consent_text_version: str
    data_processing: bool
    ai_assistance: bool
    share_with_clinician: bool
    channel: str
    created_at: datetime = Field(default_factory=utcnow)
