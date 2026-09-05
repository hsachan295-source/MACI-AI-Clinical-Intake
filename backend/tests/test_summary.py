"""Summary generation (deterministic fallback) + doctor review lifecycle."""
import io


def _run_intake(client, p, s, message="I have chest pain that started this morning"):
    client.post("/api/history/message", json={"session_id": s["id"], "patient_id": p["id"], "text": message})


def test_generate_summary_fallback(client, make_patient, make_session):
    p = make_patient(age=61, gender="male")
    s = make_session(p["id"], chief_complaint="chest pain")
    _run_intake(client, p, s)

    # attach a lab doc
    lab = "Diagnostics Lab\nHbA1c : 8.9 % (4.0 - 5.6)\nDate: 2025-02-10\n"
    up = client.post(
        "/api/documents/upload",
        data={"session_id": s["id"], "patient_id": p["id"], "document_type": "lab_report"},
        files={"file": ("lab.txt", io.BytesIO(lab.encode()), "text/plain")},
    ).json()
    client.post(f"/api/documents/{up['id']}/process", params={"patient_id": p["id"]})

    r = client.post("/api/history/generate-summary", json={"session_id": s["id"], "patient_id": p["id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["disclaimer"] == "AI-generated draft. Requires clinician review."
    assert body["used_llm_fallback"] is True
    assert body["status"] == "draft"
    assert body["history"]["chief_complaint"]
    assert body["narrative"]
    # timeline includes the current visit + a lab event
    cats = {e["category"] for e in body["timeline"]}
    assert "visit" in cats
    assert any(e["category"] == "lab" for e in body["timeline"])

    sr = client.get(f"/api/sessions/{s['id']}").json()
    assert sr["status"] == "summary_ready"


def test_summary_red_flag_forces_priority(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"], chief_complaint="chest pain")
    client.post(
        "/api/history/message",
        json={"session_id": s["id"], "patient_id": p["id"],
              "text": "crushing chest pain radiating to the jaw with sweating and breathlessness"},
    )
    r = client.post("/api/history/generate-summary", json={"session_id": s["id"], "patient_id": p["id"]})
    body = r.json()
    assert body["triage_priority"] == "emergency"
    assert body["red_flags"]


def test_summary_patch_and_confirm(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"], chief_complaint="cough")
    _run_intake(client, p, s, "dry cough for a week")
    summ = client.post(
        "/api/history/generate-summary", json={"session_id": s["id"], "patient_id": p["id"]}
    ).json()

    r = client.patch(f"/api/summaries/{summ['id']}", json={"doctor_notes": "Consider CXR."})
    assert r.status_code == 200
    assert r.json()["status"] == "edited"
    assert "CXR" in r.json()["doctor_notes"]

    r = client.post(
        f"/api/summaries/{summ['id']}/confirm",
        json={"reviewed_by": "Dr. Nair", "doctor_notes": "Reviewed, agree.", "accept_history": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "confirmed"
    assert body["reviewed_by"] == "Dr. Nair"
    assert body["confirmed_at"]


def test_summary_isolation_wrong_patient(client, make_patient, make_session):
    p1 = make_patient(full_name="One")
    p2 = make_patient(full_name="Two")
    s1 = make_session(p1["id"])
    r = client.post("/api/history/generate-summary", json={"session_id": s1["id"], "patient_id": p2["id"]})
    assert r.status_code == 403
