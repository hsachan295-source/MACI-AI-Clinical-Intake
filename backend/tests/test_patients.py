def test_create_and_get_patient(client, make_patient):
    p = make_patient(full_name="  Ravi   Kumar ")
    assert p["full_name"] == "Ravi Kumar"  # whitespace normalised
    r = client.get(f"/api/patients/{p['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == p["id"]


def test_patient_validation_rejects_bad_age(client):
    r = client.post("/api/patients", json={"full_name": "X", "age": 250})
    assert r.status_code == 422


def test_patient_validation_rejects_blank_name(client):
    r = client.post("/api/patients", json={"full_name": "   "})
    assert r.status_code == 422


def test_get_missing_patient_404(client):
    r = client.get("/api/patients/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_update_patient(client, make_patient):
    p = make_patient()
    r = client.patch(f"/api/patients/{p['id']}", json={"age": 60, "mrn": "MRN-9"})
    assert r.status_code == 200
    assert r.json()["age"] == 60
    assert r.json()["mrn"] == "MRN-9"


def test_consent_required_before_session(client, make_patient):
    p = make_patient()
    r = client.post("/api/sessions", json={"patient_id": p["id"]})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "consent_required"


def test_consent_rejects_missing_required_flag(client, make_patient):
    p = make_patient()
    r = client.post(
        f"/api/patients/{p['id']}/consent",
        json={"patient_id": p["id"], "data_processing": False,
              "ai_assistance": True, "share_with_clinician": True},
    )
    assert r.status_code == 422
