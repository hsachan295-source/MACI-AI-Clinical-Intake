"""Red-flag / triage schemas."""
from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, TriagePriority


class TriageCheckIn(ApiModel):
    text: str = Field(min_length=1, max_length=8000)
    session_id: UUID | None = None
    patient_id: UUID | None = None
    age: int | None = Field(default=None, ge=0, le=130)


class RedFlagHit(ApiModel):
    rule_id: str
    label: str
    category: str
    matched_terms: list[str] = Field(default_factory=list)
    severity: TriagePriority = TriagePriority.URGENT
    advice: str = "Please contact medical staff immediately."
    source: str = "rule"  # "rule" | "llm"


class TriageResult(ApiModel):
    red_flag: bool = False
    priority: TriagePriority = TriagePriority.STANDARD
    hits: list[RedFlagHit] = Field(default_factory=list)
    patient_message: str | None = None
    # Never asserts a diagnosis - only that staff attention is advised.
    disclaimer: str = (
        "Automated symptom screening only. This is not a diagnosis. "
        "If this is an emergency, seek immediate medical help."
    )

    @property
    def escalate(self) -> bool:
        return self.red_flag or self.priority in (
            TriagePriority.URGENT.value,
            TriagePriority.EMERGENCY.value,
            TriagePriority.URGENT,
            TriagePriority.EMERGENCY,
        )
