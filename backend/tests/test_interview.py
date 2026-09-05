"""Adaptive interview: scripted fallback + LLM path + malformed-JSON repair."""
import pytest

from app.services.groq_service import GroqBadJSON, GroqService


def _send(client, session_id, patient_id, text, **extra):
    body = {"session_id": session_id, "patient_id": patient_id, "text": text}
    body.update(extra)
    return client.post("/api/history/message", json=body)


def test_interview_uses_scripted_fallback_without_groq(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"])
    r = _send(client, s["id"], p["id"], "I have a bad cough and fever for 3 days")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["next_question"]
    assert body["question_count"] == 1
    assert body["is_complete"] is False
    assert body["triage"]["red_flag"] is False
    assert "diagnos" in body["disclaimer"].lower()

    # session advanced to in_progress
    sr = client.get(f"/api/sessions/{s['id']}")
    assert sr.json()["status"] == "in_progress"


def test_interview_detects_red_flag_and_marks_session(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"])
    r = _send(client, s["id"], p["id"], "I have crushing chest pain radiating to my left arm and cold sweats")
    assert r.status_code == 200
    body = r.json()
    assert body["triage"]["red_flag"] is True
    assert body["triage"]["priority"] == "emergency"
    assert "medical staff immediately" in body["assistant_message"].lower()

    sr = client.get(f"/api/sessions/{s['id']}").json()
    assert sr["red_flag"] is True
    assert sr["triage_priority"] == "emergency"

    # an alert row exists for the doctor dashboard
    q = client.get("/api/doctor/queue").json()
    assert any(i["session_id"] == s["id"] and i["red_flag"] for i in q["items"])


def test_interview_completes_at_question_limit(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"])
    body = None
    for i in range(12):
        r = _send(client, s["id"], p["id"], f"answer number {i}")
        assert r.status_code == 200
        body = r.json()
        if body["is_complete"]:
            break
    assert body["is_complete"] is True
    assert body["completion_pct"] == 100
    sr = client.get(f"/api/sessions/{s['id']}").json()
    assert sr["status"] == "awaiting_documents"


def test_interview_llm_path(monkeypatch, client, make_patient, make_session):
    monkeypatch.setattr(GroqService, "available", property(lambda self: True))

    async def fake_completion(self, messages, *, json_mode, temperature, max_tokens):
        return (
            '{"assistant_message":"Thanks, noted.","next_question":"How severe is it 1-10?",'
            '"is_complete":false,"suggested_replies":["3","6","9"],"focus_area":"severity",'
            '"partial_history":{"chief_complaint":"headache"}}'
        )

    monkeypatch.setattr(GroqService, "_chat_completion", fake_completion)

    p = make_patient()
    s = make_session(p["id"])
    r = _send(client, s["id"], p["id"], "I have a headache")
    assert r.status_code == 200
    body = r.json()
    assert body["next_question"] == "How severe is it 1-10?"
    assert body["suggested_replies"] == ["3", "6", "9"]
    assert body["partial_history"]["chief_complaint"] == "headache"


@pytest.mark.asyncio
async def test_chat_json_repairs_malformed_then_succeeds(monkeypatch):
    svc = GroqService()
    svc.api_key = "test"
    calls = {"n": 0}

    async def flaky(self, messages, *, json_mode, temperature, max_tokens):
        calls["n"] += 1
        if calls["n"] == 1:
            return "Sure! here is the data: {oops not json"
        return '{"assistant_message":"ok","is_complete":true}'

    monkeypatch.setattr(GroqService, "_chat_completion", flaky)
    out = await svc.chat_json("sys", "user")
    assert out["is_complete"] is True
    assert calls["n"] >= 2


@pytest.mark.asyncio
async def test_chat_json_raises_after_exhausting_retries(monkeypatch):
    svc = GroqService()
    svc.api_key = "test"

    async def always_bad(self, messages, *, json_mode, temperature, max_tokens):
        return "not json at all, sorry"

    monkeypatch.setattr(GroqService, "_chat_completion", always_bad)
    with pytest.raises(GroqBadJSON):
        await svc.chat_json("sys", "user")
