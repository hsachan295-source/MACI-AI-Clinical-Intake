"""Medical timeline schemas."""
from __future__ import annotations

from pydantic import Field

from app.schemas.common import ApiModel


class TimelineEvent(ApiModel):
    date: str = ""            # ISO date or free text ("2024", "Jan 2025")
    sort_key: str = ""        # normalised YYYY-MM-DD (best effort) for ordering
    title: str = ""
    detail: str = ""
    category: str = "general"  # diagnosis | medication | lab | procedure | visit | general
    source: str = ""          # document filename or "current-visit"
    source_document_id: str | None = None


class TimelineOut(ApiModel):
    patient_id: str
    events: list[TimelineEvent] = Field(default_factory=list)
    generated_from: list[str] = Field(default_factory=list)
