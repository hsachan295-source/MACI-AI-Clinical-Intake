"""Structured clinical history - the validated JSON contract for LLM output.

The LLM is *required* to return an object matching ``StructuredClinicalHistory``.
``coerce_structured_history`` accepts partial / slightly-malformed payloads and
normalises them; combined with the JSON-repair retry loop in ``groq_service`` it
guarantees the rest of the system only ever sees a valid object.
"""
from __future__ import annotations

from typing import Any

from pydantic import Field, field_validator

from app.schemas.common import ApiModel, TriagePriority


class HistoryOfPresentIllness(ApiModel):
    onset: str = ""
    duration: str = ""
    location: str = ""
    character: str = ""
    severity: str = ""
    radiation: str = ""
    timing: str = ""
    context: str = ""
    aggravating_factors: list[str] = Field(default_factory=list)
    relieving_factors: list[str] = Field(default_factory=list)
    associated_symptoms: list[str] = Field(default_factory=list)
    progression: str = ""

    @field_validator(
        "aggravating_factors", "relieving_factors", "associated_symptoms", mode="before"
    )
    @classmethod
    def _listify(cls, v: Any) -> list[str]:
        return _as_str_list(v)


class PersonalHistory(ApiModel):
    smoking: str = ""
    alcohol: str = ""
    diet: str = ""
    sleep: str = ""
    exercise: str = ""
    occupation: str = ""
    recreational_drugs: str = ""
    notes: str = ""


class MedicationItem(ApiModel):
    name: str = ""
    dosage: str = ""
    frequency: str = ""
    route: str = ""
    since: str = ""
    indication: str = ""


class StructuredClinicalHistory(ApiModel):
    """Physician-oriented structured history. Mirrors the project spec schema."""

    chief_complaint: str = ""
    history_of_present_illness: HistoryOfPresentIllness = Field(
        default_factory=HistoryOfPresentIllness
    )
    past_medical_history: list[str] = Field(default_factory=list)
    past_surgical_history: list[str] = Field(default_factory=list)
    medications: list[MedicationItem] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    family_history: list[str] = Field(default_factory=list)
    personal_history: PersonalHistory = Field(default_factory=PersonalHistory)
    review_of_systems: dict[str, str] = Field(default_factory=dict)
    previous_investigations: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    triage_priority: TriagePriority = TriagePriority.STANDARD
    doctor_attention_points: list[str] = Field(default_factory=list)
    completeness_score: int = Field(default=0, ge=0, le=100)
    missing_information: list[str] = Field(default_factory=list)

    @field_validator(
        "past_medical_history",
        "past_surgical_history",
        "allergies",
        "family_history",
        "previous_investigations",
        "red_flags",
        "doctor_attention_points",
        "missing_information",
        mode="before",
    )
    @classmethod
    def _listify(cls, v: Any) -> list[str]:
        return _as_str_list(v)

    @field_validator("review_of_systems", mode="before")
    @classmethod
    def _dictify(cls, v: Any) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): _flatten(val) for k, val in v.items()}
        if isinstance(v, list):
            return {str(i): _flatten(item) for i, item in enumerate(v)}
        if v in (None, ""):
            return {}
        return {"notes": str(v)}

    @field_validator("medications", mode="before")
    @classmethod
    def _meds(cls, v: Any) -> list[dict]:
        out: list[dict] = []
        if isinstance(v, str):
            v = [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    out.append(item)
                elif isinstance(item, str) and item.strip():
                    out.append({"name": item.strip()})
        return out

    @field_validator("triage_priority", mode="before")
    @classmethod
    def _priority(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip().lower()
            aliases = {
                "immediate": "emergency",
                "critical": "emergency",
                "high": "urgent",
                "medium": "standard",
                "normal": "standard",
                "low": "routine",
                "": "standard",
            }
            v = aliases.get(v, v)
            if v not in {p.value for p in TriagePriority}:
                return TriagePriority.STANDARD.value
        return v

    @field_validator("completeness_score", mode="before")
    @classmethod
    def _score(cls, v: Any) -> int:
        try:
            n = int(round(float(v)))
        except (TypeError, ValueError):
            return 0
        return max(0, min(100, n))


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _flatten(v: Any) -> str:
    if isinstance(v, (list, tuple)):
        return ", ".join(str(x) for x in v)
    if isinstance(v, dict):
        return ", ".join(f"{k}: {val}" for k, val in v.items())
    return "" if v is None else str(v)


def _as_str_list(v: Any) -> list[str]:
    if v in (None, "", [], {}):
        return []
    if isinstance(v, str):
        text = v.strip()
        if not text:
            return []
        # Split on newlines / semicolons first, then commas if it was a flat line.
        if "\n" in text or ";" in text:
            chunks = [c for c in (p.strip(" -*•\t") for p in text.replace(";", "\n").splitlines())]
        else:
            chunks = [c.strip() for c in text.split(",")]
        return [c for c in chunks if c]
    if isinstance(v, dict):
        return [f"{k}: {_flatten(val)}" for k, val in v.items()]
    if isinstance(v, (list, tuple, set)):
        out: list[str] = []
        for item in v:
            if isinstance(item, dict):
                # common shapes: {"name": "..."} / {"value": "..."}
                out.append(item.get("name") or item.get("value") or _flatten(item))
            elif item not in (None, ""):
                out.append(str(item).strip())
        return [o for o in out if o]
    return [str(v)]


def coerce_structured_history(raw: dict[str, Any] | None) -> StructuredClinicalHistory:
    """Best-effort build of a valid history object from arbitrary LLM output."""
    if not isinstance(raw, dict):
        return StructuredClinicalHistory()
    # Unwrap a single top-level wrapper key if the model nested the payload.
    if len(raw) == 1:
        (only_val,) = raw.values()
        if isinstance(only_val, dict) and {"chief_complaint", "history_of_present_illness"} & only_val.keys():
            raw = only_val
    try:
        return StructuredClinicalHistory.model_validate(raw)
    except Exception:
        # Field-by-field salvage.
        safe: dict[str, Any] = {}
        for name in StructuredClinicalHistory.model_fields:
            if name in raw:
                safe[name] = raw[name]
        try:
            return StructuredClinicalHistory.model_validate(safe)
        except Exception:
            return StructuredClinicalHistory()
