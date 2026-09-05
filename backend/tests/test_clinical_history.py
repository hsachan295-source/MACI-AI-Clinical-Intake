"""Structured clinical-history validation + malformed-LLM-response handling."""
import pytest

from app.schemas.clinical_history import StructuredClinicalHistory, coerce_structured_history
from app.services.groq_service import _extract_json_object


def test_coerce_from_empty():
    h = coerce_structured_history(None)
    assert isinstance(h, StructuredClinicalHistory)
    assert h.triage_priority == "standard"
    assert h.medications == []


def test_coerce_normalises_loose_types():
    raw = {
        "chief_complaint": "chest pain",
        "history_of_present_illness": {
            "onset": "2 hours ago",
            "aggravating_factors": "walking, climbing stairs",  # str -> list
            "associated_symptoms": ["sweating", {"name": "nausea"}],  # mixed
        },
        "past_medical_history": "Hypertension; Type 2 diabetes",  # str -> list
        "medications": "Aspirin, Metformin",  # str -> list[obj]
        "allergies": None,
        "review_of_systems": ["cardio ok", "resp ok"],  # list -> dict
        "triage_priority": "HIGH",  # alias -> urgent
        "completeness_score": "87.4",
    }
    h = coerce_structured_history(raw)
    assert h.history_of_present_illness.aggravating_factors == ["walking", "climbing stairs"]
    assert "sweating" in h.history_of_present_illness.associated_symptoms
    assert "nausea" in h.history_of_present_illness.associated_symptoms
    assert h.past_medical_history == ["Hypertension", "Type 2 diabetes"]
    assert [m.name for m in h.medications] == ["Aspirin", "Metformin"]
    assert h.allergies == []
    assert h.review_of_systems == {"0": "cardio ok", "1": "resp ok"}
    assert h.triage_priority == "urgent"
    assert h.completeness_score == 87


def test_coerce_unwraps_single_wrapper_key():
    raw = {"result": {"chief_complaint": "cough", "history_of_present_illness": {"onset": "3 days"}}}
    h = coerce_structured_history(raw)
    assert h.chief_complaint == "cough"
    assert h.history_of_present_illness.onset == "3 days"


def test_coerce_survives_garbage():
    h = coerce_structured_history({"triage_priority": ["not", "a", "string"], "medications": 12345})
    assert isinstance(h, StructuredClinicalHistory)
    assert h.triage_priority == "standard"


@pytest.mark.parametrize(
    "text",
    [
        '{"a": 1}',
        'Here is your JSON:\n```json\n{"a": 1}\n```\nThanks!',
        'prefix {"a": {"b": [1,2,3]}, "c": "}"} suffix',
        '\n\n  {"a": 1}  \n',
    ],
)
def test_extract_json_object_recovers(text):
    assert _extract_json_object(text) == {"a": 1} or _extract_json_object(text)["a"] is not None


def test_extract_json_object_returns_none_on_no_json():
    assert _extract_json_object("no json here at all") is None
    assert _extract_json_object("") is None
