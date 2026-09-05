"""AYUSH / Ayurveda intake schemas (optional mode).

Kept deliberately separate from the standard clinical intake. These fields are
descriptive assessment attributes used in Ayurvedic practice; they are recorded
verbatim and are never mixed into the biomedical red-flag / triage logic.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, utcnow


class AyushAssessment(ApiModel):
    prakriti: str = Field(default="", description="Constitution (Vata/Pitta/Kapha blend)")
    vikriti: str = Field(default="", description="Current imbalance")
    sara: str = Field(default="", description="Tissue excellence")
    samhanana: str = Field(default="", description="Body compactness / build")
    pramana: str = Field(default="", description="Body proportion / measurements")
    satmya: str = Field(default="", description="Suitability / adaptability")
    sattva: str = Field(default="", description="Mental strength")
    ahara_shakti: str = Field(default="", description="Digestive / food capacity")
    vyayama_shakti: str = Field(default="", description="Capacity for exercise")
    vaya: str = Field(default="", description="Age category (Bala/Madhya/Vriddha)")
    ahara_vihara: str = Field(default="", description="Diet and lifestyle routine")
    additional_notes: str = ""


class AyushAssessmentIn(ApiModel):
    session_id: UUID
    patient_id: UUID
    assessment: AyushAssessment


class AyushAssessmentOut(ApiModel):
    id: UUID
    session_id: UUID
    patient_id: UUID
    assessment: AyushAssessment
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
