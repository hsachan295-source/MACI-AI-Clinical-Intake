"""Document upload / OCR / structured-extraction schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import ApiModel, DocumentStatus, DocumentType, utcnow


class MedicationExtract(ApiModel):
    name: str = ""
    dosage: str = ""
    frequency: str = ""
    route: str = ""
    duration: str = ""
    instructions: str = ""


class LabResultExtract(ApiModel):
    test_name: str = ""
    value: str = ""
    unit: str = ""
    reference_range: str = ""
    flag: str = ""  # e.g. "high", "low", "normal"
    observed_at: str = ""


class StructuredDocument(ApiModel):
    """Validated structured representation of a single medical document."""

    document_type: DocumentType = DocumentType.OTHER
    document_date: str = ""
    hospital_or_clinic: str = ""
    doctor_name: str = ""
    diagnoses: list[str] = Field(default_factory=list)
    medications: list[MedicationExtract] = Field(default_factory=list)
    lab_results: list[LabResultExtract] = Field(default_factory=list)
    procedures: list[str] = Field(default_factory=list)
    previous_surgeries: list[str] = Field(default_factory=list)
    vitals: dict[str, str] = Field(default_factory=dict)
    important_notes: list[str] = Field(default_factory=list)
    follow_up: str = ""

    @field_validator(
        "diagnoses", "procedures", "previous_surgeries", "important_notes", mode="before"
    )
    @classmethod
    def _listify(cls, v: Any) -> list[str]:
        if v in (None, "", [], {}):
            return []
        if isinstance(v, str):
            return [s.strip() for s in v.replace(";", "\n").splitlines() if s.strip()]
        if isinstance(v, (list, tuple, set)):
            return [str(x).strip() for x in v if str(x).strip()]
        return [str(v)]

    @field_validator("vitals", mode="before")
    @classmethod
    def _vitals(cls, v: Any) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): str(val) for k, val in v.items()}
        return {}

    @field_validator("document_type", mode="before")
    @classmethod
    def _dtype(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip().lower().replace(" ", "_")
            aliases = {
                "rx": "prescription",
                "prescription_note": "prescription",
                "lab": "lab_report",
                "laboratory_report": "lab_report",
                "blood_report": "lab_report",
                "discharge": "discharge_summary",
                "discharge_note": "discharge_summary",
                "radiology_report": "imaging_report",
                "scan": "imaging_report",
                "referral_letter": "referral",
            }
            v = aliases.get(v, v)
            if v not in {d.value for d in DocumentType}:
                return DocumentType.OTHER.value
        return v


class DocumentOut(ApiModel):
    id: UUID
    session_id: UUID
    patient_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    document_type: str = DocumentType.OTHER.value
    status: str = DocumentStatus.UPLOADED.value
    ocr_text: str | None = None
    ocr_engine: str | None = None
    ocr_confidence: float | None = None
    structured: StructuredDocument | None = None
    error: str | None = None
    corrected_by_user: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class DocumentProcessOut(ApiModel):
    document: DocumentOut
    used_ocr_fallback: bool = False
    used_llm_fallback: bool = False
    message: str = "Document processed."


class DocumentCorrectionIn(ApiModel):
    """Doctor / patient correction of OCR text or structured fields."""

    ocr_text: str | None = None
    structured: StructuredDocument | None = None
    document_type: DocumentType | None = None
