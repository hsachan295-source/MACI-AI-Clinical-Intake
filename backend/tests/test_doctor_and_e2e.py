"""Doctor dashboard + full patient -> doctor end-to-end flow."""
import io


def test_doctor_queue_orders_by_priority(client, make_patient, make_session):
    routine_p = make_patient(full_name="Routine Person")
    urgent_p = make_patient(full_name="Urgent Person")
    rs = make_session(routine_p["id"])
    us = make_session(urgent_p["id"])
    client.post("/api/history/message", json={"session_id": rs["id"], "patient_id": routine_p["id"],
                                              "text": "mild rash on my arm for a week"})
    client.post("/api/history/message", json={"session_id": us["id"], "patient_id": urgent_p["id"],
                                              "text": "I cannot breathe and my lips look blue"})
    q = client.get("/api/doctor/queue").json()
    assert q["total"] >= 2
    assert q["items"][0]["session_id"] == us["id"]  # emergency first
    assert q["items"][0]["red_flag"] is True


def test_doctor_analytics_shape(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"])
    client.post("/api/history/message", json={"session_id": s["id"], "patient_id": p["id"], "text": "chest pain"})
    a = client.get("/api/doctor/analytics").json()
    for key in ("patients_today", "waiting", "high_priority", "completed_intake", "average_intake_minutes"):
        assert key in a
    assert isinstance(a["by_priority"], list) and len(a["by_priority"]) == 4
    assert isinstance(a["by_complaint_category"], list)


def test_full_flow_patient_to_doctor(client, make_patient, make_session):
    # 1. patient + consent + session
    p = make_patient(full_name="Meera Iyer", age=58, gender="female")
    s = make_session(p["id"], chief_complaint="chest discomfort")

    # 2. adaptive interview (a couple of turns)
    for msg in ["chest discomfort since last night", "it is a dull ache, about 6 out of 10"]:
        r = client.post("/api/history/message",
                        json={"session_id": s["id"], "patient_id": p["id"], "text": msg})
        assert r.status_code == 200

    # 3. upload + process a prescription
    rx = "Care Hospital\nDate: 2025-01-05\nTab Atorvastatin 10 mg 0-0-1\nTab Aspirin 75 mg 1-0-0\n"
    up = client.post(
        "/api/documents/upload",
        data={"session_id": s["id"], "patient_id": p["id"], "document_type": "prescription"},
        files={"file": ("rx.txt", io.BytesIO(rx.encode()), "text/plain")},
    ).json()
    proc = client.post(f"/api/documents/{up['id']}/process", params={"patient_id": p["id"]}).json()
    assert proc["document"]["status"] == "structured"

    # 4. generate summary
    summ = client.post("/api/history/generate-summary",
                       json={"session_id": s["id"], "patient_id": p["id"]}).json()
    assert summ["history"]["chief_complaint"]

    # 5. submit to doctor
    sub = client.post(f"/api/sessions/{s['id']}/submit").json()
    assert sub["status"] == "submitted"

    # 6. doctor sees it in the queue
    q = client.get("/api/doctor/queue").json()
    assert any(i["session_id"] == s["id"] for i in q["items"])

    # 7. doctor opens the patient view
    view = client.get(f"/api/doctor/patients/{p['id']}/summary", params={"session_id": s["id"]}).json()
    assert view["overview"]["full_name"] == "Meera Iyer"
    assert view["summary"]["disclaimer"] == "AI-generated draft. Requires clinician review."
    assert len(view["documents"]) == 1
    assert view["timeline"]

    # 8. doctor edits + confirms the summary
    client.patch(f"/api/summaries/{summ['id']}", json={"doctor_notes": "Order troponin + ECG."})
    conf = client.post(f"/api/summaries/{summ['id']}/confirm",
                       json={"reviewed_by": "Dr. Rao", "accept_history": True}).json()
    assert conf["status"] == "confirmed"

    # 9. doctor marks the patient reviewed
    rev = client.post(f"/api/doctor/sessions/{s['id']}/reviewed", json={"reviewed_by": "Dr. Rao"}).json()
    assert rev["status"] == "reviewed"
    q2 = client.get("/api/doctor/queue").json()
    assert all(i["session_id"] != s["id"] for i in q2["items"])  # left the active queue


def test_triage_endpoint_direct(client):
    r = client.post("/api/triage/check", json={"text": "I think I'm having a stroke, my face is drooping"})
    assert r.status_code == 200
    body = r.json()
    assert body["red_flag"] is True
    assert body["priority"] == "emergency"


def test_ayush_mode_is_separate(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"], clinical_mode="ayush")
    r = client.post("/api/ayush/assessment", json={
        "session_id": s["id"], "patient_id": p["id"],
        "assessment": {"prakriti": "Vata-Pitta", "vikriti": "Pitta aggravation", "agni": "", "ahara_shakti": "moderate"},
    })
    assert r.status_code == 201
    assert r.json()["assessment"]["prakriti"] == "Vata-Pitta"
    got = client.get(f"/api/ayush/assessment/{s['id']}").json()
    assert got["assessment"]["vikriti"] == "Pitta aggravation"


def test_abdm_is_stub_only(client):
    r = client.get("/api/abdm/status").json()
    assert r["integration_status"] == "future-sandbox"
    r2 = client.post("/api/abdm/abha/lookup", json={"abha_id": "12-3456-7890-1234"}).json()
    assert r2["ok"] is False
