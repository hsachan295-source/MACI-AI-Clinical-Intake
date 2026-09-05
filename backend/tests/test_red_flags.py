"""Deterministic red-flag safety layer."""
import pytest

from app.services.red_flag_service import find_red_flags, merge_triage, PATIENT_ALERT_TEXT
from app.schemas.triage import TriageResult


@pytest.mark.parametrize(
    "text,expect_priority",
    [
        ("I have crushing chest pain radiating to my left arm and I'm sweating", "emergency"),
        ("I can't breathe and my lips are turning blue", "emergency"),
        ("My face is drooping and my speech is slurred since this morning", "emergency"),
        ("He passed out and won't wake up", "emergency"),
        ("I am vomiting blood since last night", "emergency"),
        ("The pain is 10/10, worst pain of my life", "urgent"),
        ("I want to end my life", "emergency"),
    ],
)
def test_detects_emergencies(text, expect_priority):
    res = find_red_flags(text)
    assert res.red_flag is True
    assert res.priority == expect_priority
    assert res.patient_message == PATIENT_ALERT_TEXT
    assert res.escalate is True


def test_negation_is_respected():
    res = find_red_flags("No chest pain, no shortness of breath, denies vomiting blood")
    assert res.red_flag is False
    assert res.priority == "standard"


def test_plain_symptom_is_not_flagged():
    res = find_red_flags("I have had a mild sore throat and runny nose for two days")
    assert res.red_flag is False


def test_message_never_claims_diagnosis():
    res = find_red_flags("crushing chest pain with sweating")
    blob = " ".join([res.patient_message or "", res.disclaimer])
    assert "diagnos" in res.disclaimer.lower()  # explicitly says NOT a diagnosis
    assert "confirmed" not in blob.lower()


def test_merge_triage_takes_highest():
    a = find_red_flags("worst pain of my life")           # urgent
    b = find_red_flags("I can't breathe at all")          # emergency
    merged = merge_triage(a, b, TriageResult())
    assert merged.priority == "emergency"
    assert merged.red_flag is True
    assert len(merged.hits) >= 2
