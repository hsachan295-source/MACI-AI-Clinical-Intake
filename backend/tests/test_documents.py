"""Document upload, validation, OCR fallback, heuristic structuring, correction."""
import io

from app.services.document_service import heuristic_structure, validate_upload
from app.core.errors import FileValidationError
import pytest


PRESCRIPTION_TEXT = """City Care Hospital
Date: 14/03/2025
Dr. Anil Mehta

Rx
Tab Amlodipine 5 mg 1-0-0
Tab Metformin 500 mg 1-0-1
Cap Omeprazole 20 mg 1-0-0

Advice: Low salt diet, review after 2 weeks
Follow-up: 28/03/2025
"""

LAB_TEXT = """Sunrise Diagnostics Laboratory
Patient lab report
Specimen: Blood
HbA1c : 8.2 %  (Reference 4.0 - 5.6)
Fasting Glucose : 156 mg/dL (70 - 100)
Creatinine : 1.1 mg/dL (0.7 - 1.3)
"""


def test_validate_upload_rejects_large(monkeypatch):
    with pytest.raises(FileValidationError):
        validate_upload(filename="a.png", content_type="image/png", size_bytes=99 * 1024 * 1024)


def test_validate_upload_rejects_unknown_ext():
    with pytest.raises(FileValidationError):
        validate_upload(filename="a.exe", content_type="application/octet-stream", size_bytes=10)


def test_validate_upload_rejects_empty():
    with pytest.raises(FileValidationError):
        validate_upload(filename="a.png", content_type="image/png", size_bytes=0)


def test_heuristic_structure_prescription():
    sd = heuristic_structure(PRESCRIPTION_TEXT)
    assert sd.document_type == "prescription"
    names = {m.name.lower() for m in sd.medications}
    assert "amlodipine" in names and "metformin" in names
    assert sd.document_date == "14/03/2025"
    assert "Dr. Anil Mehta" in sd.doctor_name


def test_heuristic_structure_lab():
    sd = heuristic_structure(LAB_TEXT)
    assert sd.document_type == "lab_report"
    tests = {l.test_name.lower(): l for l in sd.lab_results}
    assert "hba1c" in tests
    assert tests["hba1c"].value.startswith("8.2")
    assert "5.6" in tests["hba1c"].reference_range


def test_upload_process_correct_flow(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"])

    files = {"file": ("rx.txt", io.BytesIO(PRESCRIPTION_TEXT.encode()), "text/plain")}
    data = {"session_id": s["id"], "patient_id": p["id"], "document_type": "prescription"}
    r = client.post("/api/documents/upload", data=data, files=files)
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["status"] == "uploaded"

    r = client.post(f"/api/documents/{doc['id']}/process", params={"patient_id": p["id"]})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["document"]["status"] == "structured"
    assert out["used_llm_fallback"] is True  # no Groq in tests
    assert out["document"]["structured"]["document_type"] == "prescription"
    assert len(out["document"]["structured"]["medications"]) >= 2

    # correction endpoint
    r = client.patch(
        f"/api/documents/{doc['id']}",
        params={"patient_id": p["id"]},
        json={"document_type": "discharge_summary"},
    )
    assert r.status_code == 200
    assert r.json()["document_type"] == "discharge_summary"
    assert r.json()["corrected_by_user"] is True


def test_document_patient_isolation(client, make_patient, make_session):
    p1 = make_patient(full_name="Patient One")
    p2 = make_patient(full_name="Patient Two")
    s1 = make_session(p1["id"])
    files = {"file": ("n.txt", io.BytesIO(b"note text"), "text/plain")}
    r = client.post(
        "/api/documents/upload",
        data={"session_id": s1["id"], "patient_id": p1["id"]},
        files=files,
    )
    doc_id = r.json()["id"]
    # p2 must not be able to read p1's document
    r = client.get(f"/api/documents/{doc_id}", params={"patient_id": p2["id"]})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "patient_isolation_violation"


def test_unsupported_mime_rejected(client, make_patient, make_session):
    p = make_patient()
    s = make_session(p["id"])
    files = {"file": ("a.png", io.BytesIO(b"x" * 20), "application/x-msdownload")}
    r = client.post(
        "/api/documents/upload",
        data={"session_id": s["id"], "patient_id": p["id"]},
        files=files,
    )
    assert r.status_code == 415
