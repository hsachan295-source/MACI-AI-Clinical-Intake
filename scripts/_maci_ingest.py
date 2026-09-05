"""Shared dataset-ingestion helpers for the MACI scripts.

Reads a *unified intake record* (see ``data/README_DATA.md``) from CSV / JSON /
JSONL and writes it into whatever repository the backend is configured to use
(Supabase if keys are present, otherwise the in-memory store). Optionally
indexes the resulting documents + summary into the vector store.

The application code is imported, not duplicated - so importing the real
dataset never requires changing the app.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.core.logging import configure_logging, get_logger  # noqa: E402
from app.models.entities import (  # noqa: E402
    AlertEntity,
    AyushAssessmentEntity,
    ClinicalSummaryEntity,
    ConsentEntity,
    DocumentEntity,
    InterviewMessageEntity,
    MedicalHistoryEntity,
    PatientEntity,
    SessionEntity,
)
from app.repositories import get_repository  # noqa: E402
from app.schemas.clinical_history import coerce_structured_history  # noqa: E402
from app.schemas.common import DocumentStatus, SessionStatus  # noqa: E402
from app.schemas.document import StructuredDocument  # noqa: E402
from app.services.document_service import heuristic_structure  # noqa: E402
from app.services.pinecone_service import VectorRecord, get_vector_store  # noqa: E402
from app.services.red_flag_service import find_red_flags  # noqa: E402
from app.services.timeline_service import build_timeline  # noqa: E402

configure_logging("INFO")
log = get_logger("scripts.ingest")

CSV_JSON_COLUMNS = {"transcript_json", "documents_json", "history_json", "summary_json", "ayush_json"}


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
def load_records(path: str | Path, fmt: str = "auto") -> list[dict]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)
    if fmt == "auto":
        fmt = {".jsonl": "jsonl", ".ndjson": "jsonl", ".json": "json", ".csv": "csv"}.get(
            p.suffix.lower(), "json"
        )

    if fmt == "jsonl":
        out = []
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{p.name}: line {i} is not valid JSON ({e})") from e
        return out

    if fmt == "json":
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("records") or data.get("data") or [data]
        if not isinstance(data, list):
            raise ValueError(f"{p.name}: expected a list of records or {{'records': [...]}}")
        return data

    if fmt == "csv":
        with p.open(newline="", encoding="utf-8") as fh:
            return [_csv_row_to_record(row) for row in csv.DictReader(fh)]

    raise ValueError(f"Unsupported format: {fmt}")


def _csv_row_to_record(row: dict[str, str]) -> dict:
    def g(*names: str) -> str | None:
        for n in names:
            v = row.get(n)
            if v not in (None, ""):
                return v
        return None

    def gj(name: str) -> Any:
        raw = row.get(name)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            log.warning("CSV column %s is not valid JSON - ignoring", name)
            return None

    rec: dict[str, Any] = {
        "patient": {
            "external_id": g("external_id", "patient_external_id"),
            "full_name": g("full_name", "patient_full_name", "name"),
            "age": _int(g("age", "patient_age")),
            "gender": (g("gender", "patient_gender") or "undisclosed").lower(),
            "preferred_language": (g("preferred_language", "patient_language") or "en").lower(),
            "phone": g("phone"),
            "mrn": g("mrn"),
            "abha_id": g("abha_id"),
        },
        "session": {
            "chief_complaint": g("chief_complaint", "complaint"),
            "language": (g("session_language", "language") or "en").lower(),
            "mode": (g("mode") or "text").lower(),
            "clinical_mode": (g("clinical_mode") or "general").lower(),
            "department": g("department"),
            "status": (g("status") or "submitted").lower(),
        },
        "transcript": gj("transcript_json") or [],
        "documents": gj("documents_json") or [],
        "history": gj("history_json"),
        "summary": gj("summary_json"),
        "ayush": gj("ayush_json"),
    }
    return rec


def _int(v: Any) -> int | None:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- #
# Normalisation + validation
# --------------------------------------------------------------------------- #
def normalize_record(rec: dict) -> dict:
    if not isinstance(rec, dict):
        raise ValueError("record must be an object")
    patient = dict(rec.get("patient") or {})
    if not patient.get("full_name"):
        raise ValueError("record.patient.full_name is required")
    patient.setdefault("gender", "undisclosed")
    patient.setdefault("preferred_language", "en")

    session = dict(rec.get("session") or {})
    session.setdefault("language", patient.get("preferred_language", "en"))
    session.setdefault("mode", "text")
    session.setdefault("clinical_mode", "general")
    session.setdefault("status", "submitted")

    return {
        "patient": patient,
        "session": session,
        "transcript": list(rec.get("transcript") or []),
        "documents": list(rec.get("documents") or []),
        "history": rec.get("history"),
        "summary": rec.get("summary"),
        "ayush": rec.get("ayush"),
    }


# --------------------------------------------------------------------------- #
# Ingestion
# --------------------------------------------------------------------------- #
def _find_patient(repo, patient: dict) -> dict | None:
    mrn = patient.get("mrn")
    if mrn:
        for row in repo.query("patients", mrn=mrn):
            return row
    return None


def ingest_record(repo, raw: dict, *, do_index: bool = True) -> dict:
    rec = normalize_record(raw)
    p = rec["patient"]

    existing = _find_patient(repo, p)
    if existing:
        patient_row = existing
        log.info("Reusing patient %s (mrn=%s)", patient_row["id"], p.get("mrn"))
    else:
        patient_row = repo.create(
            "patients",
            PatientEntity(
                full_name=p["full_name"],
                age=p.get("age"),
                gender=p.get("gender", "undisclosed"),
                preferred_language=p.get("preferred_language", "en"),
                phone=p.get("phone"),
                mrn=p.get("mrn"),
                abha_id=p.get("abha_id"),
            ),
        )
    patient_id = patient_row["id"]

    repo.create(
        "consents",
        ConsentEntity(
            patient_id=patient_id, data_processing=True, ai_assistance=True,
            share_with_clinician=True, channel="dataset-import",
        ),
    )

    s = rec["session"]
    transcript = [
        {"role": t.get("role", "patient"), "text": str(t.get("text", ""))}
        for t in rec["transcript"]
        if t.get("text")
    ]
    combined_patient_text = "\n".join(t["text"] for t in transcript if t["role"] == "patient")
    triage = find_red_flags(combined_patient_text + "\n" + (s.get("chief_complaint") or ""))

    session_row = repo.create(
        "clinical_sessions",
        SessionEntity(
            patient_id=patient_id,
            language=s.get("language", "en"),
            mode=s.get("mode", "text"),
            clinical_mode=s.get("clinical_mode", "general"),
            department=s.get("department"),
            chief_complaint=s.get("chief_complaint"),
            status=_session_status(s.get("status")),
            triage_priority=triage.priority if isinstance(triage.priority, str) else triage.priority.value,
            red_flag=bool(triage.red_flag),
            question_count=sum(1 for t in transcript if t["role"] == "assistant"),
            completion_pct=100 if transcript else 0,
            transcript=transcript,
            partial_history=coerce_structured_history(rec["history"]).model_dump(mode="json") if rec["history"] else None,
        ),
    )
    session_id = session_row["id"]

    for idx, turn in enumerate(transcript):
        repo.create(
            "clinical_answers",
            InterviewMessageEntity(
                session_id=session_id, patient_id=patient_id,
                role=turn["role"], text=turn["text"], question_index=idx,
            ),
        )

    doc_rows: list[dict] = []
    for d in rec["documents"]:
        text = d.get("text") or d.get("ocr_text") or ""
        if d.get("structured"):
            try:
                structured = StructuredDocument.model_validate(d["structured"])
            except Exception:
                structured = heuristic_structure(text)
        else:
            structured = heuristic_structure(text)
        if d.get("document_type"):
            structured.document_type = str(d["document_type"])
        if d.get("document_date") and not structured.document_date:
            structured.document_date = str(d["document_date"])
        row = repo.create(
            "documents",
            DocumentEntity(
                session_id=session_id, patient_id=patient_id,
                filename=d.get("filename", "imported_document.txt"),
                content_type="text/plain",
                size_bytes=len(text.encode("utf-8")),
                document_type=structured.document_type if isinstance(structured.document_type, str) else structured.document_type.value,
                status=DocumentStatus.STRUCTURED,
                ocr_text=text, ocr_engine="dataset-import", ocr_confidence=1.0,
                structured=structured.model_dump(mode="json"),
                indexed_in_pinecone=False,
            ),
        )
        doc_rows.append(row)

    history = coerce_structured_history(rec["history"]) if rec["history"] else coerce_structured_history(None)
    if not history.chief_complaint:
        history.chief_complaint = s.get("chief_complaint") or ""
    repo.create(
        "medical_histories",
        MedicalHistoryEntity(
            patient_id=patient_id, session_id=session_id,
            structured=history.model_dump(mode="json"),
            completeness_score=history.completeness_score, source="dataset-import",
        ),
    )

    summ = rec["summary"] or {}
    timeline = build_timeline(
        patient_id=str(patient_id), documents=doc_rows,
        chief_complaint=s.get("chief_complaint") or "",
    ).events
    red_flags = list(dict.fromkeys((summ.get("red_flags") or []) + [h.label for h in triage.hits]))
    summary_row = repo.create(
        "clinical_summaries",
        ClinicalSummaryEntity(
            session_id=session_id, patient_id=patient_id,
            status="draft",
            narrative=summ.get("narrative", ""),
            history=(coerce_structured_history(summ["history"]).model_dump(mode="json") if summ.get("history") else history.model_dump(mode="json")),
            document_intelligence=[d["structured"] for d in doc_rows if d.get("structured")],
            timeline=[t.model_dump(mode="json") for t in timeline],
            red_flags=red_flags,
            attention_points=summ.get("attention_points") or history.doctor_attention_points,
            triage_priority=summ.get("triage_priority") or (triage.priority if isinstance(triage.priority, str) else triage.priority.value),
            used_llm_fallback=True,
            model_name="dataset-import",
        ),
    )

    for hit in triage.hits:
        repo.create(
            "alerts",
            AlertEntity(
                session_id=session_id, patient_id=patient_id, kind="red_flag",
                label=hit.label, detail=", ".join(hit.matched_terms) or hit.category,
                severity=hit.severity if isinstance(hit.severity, str) else hit.severity.value,
                source="rule",
            ),
        )

    if rec["ayush"]:
        repo.create(
            "ayush_assessments",
            AyushAssessmentEntity(session_id=session_id, patient_id=patient_id, assessment=rec["ayush"]),
        )

    indexed = 0
    if do_index:
        indexed = index_patient(repo, patient_id)

    return {
        "patient_id": str(patient_id),
        "session_id": str(session_id),
        "summary_id": str(summary_row["id"]),
        "documents": [str(d["id"]) for d in doc_rows],
        "vectors_indexed": indexed,
        "red_flag": bool(triage.red_flag),
    }


def _session_status(value: str | None):
    try:
        return SessionStatus(value) if value else SessionStatus.SUBMITTED
    except ValueError:
        return SessionStatus.SUBMITTED


# --------------------------------------------------------------------------- #
# Indexing
# --------------------------------------------------------------------------- #
def _chunk(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    text = (text or "").strip()
    if len(text) <= size:
        return [text] if text else []
    chunks, start = [], 0
    while start < len(text):
        chunks.append(text[start : start + size])
        start += size - overlap
    return chunks


def index_patient(repo, patient_id: str | Any) -> int:
    """(Re)index every document, summary and history for one patient."""
    store = get_vector_store()
    pid = str(patient_id)
    records: list[VectorRecord] = []

    for d in repo.query("documents", patient_id=pid):
        md = {"patient_id": pid, "session_id": str(d.get("session_id") or ""),
              "document_id": str(d["id"]), "kind": "document",
              "document_type": d.get("document_type", "other"), "source": d.get("filename", "document")}
        for i, ch in enumerate(_chunk(d.get("ocr_text") or "")):
            records.append(VectorRecord(id=f"doc::{d['id']}::{i}", text=ch, metadata=dict(md)))
        struct = d.get("structured") or {}
        if struct:
            summary_line = (
                f"{struct.get('document_type','document')} dated {struct.get('document_date') or 'unknown'}. "
                f"Diagnoses: {', '.join(struct.get('diagnoses') or []) or 'none'}. "
                f"Medications: {', '.join(m.get('name','') for m in struct.get('medications') or []) or 'none'}."
            )
            records.append(VectorRecord(id=f"doc::{d['id']}::summary", text=summary_line, metadata=dict(md)))

    for sm in repo.query("clinical_summaries", patient_id=pid):
        records.append(
            VectorRecord(
                id=f"summary::{sm['id']}",
                text=f"Clinical summary: {sm.get('narrative','')}",
                metadata={"patient_id": pid, "session_id": str(sm.get("session_id") or ""),
                          "kind": "clinical_summary", "source": "clinical_summary"},
            )
        )

    for h in repo.query("medical_histories", patient_id=pid):
        struct = h.get("structured") or {}
        text = json.dumps(struct)[:1500]
        records.append(
            VectorRecord(
                id=f"history::{h['id']}", text=f"Structured history: {text}",
                metadata={"patient_id": pid, "session_id": str(h.get("session_id") or ""),
                          "kind": "medical_history", "source": "medical_history"},
            )
        )

    if not records:
        return 0
    try:
        store.upsert(pid, records)
    except Exception as exc:  # noqa: BLE001
        log.warning("Indexing failed for patient %s (%s)", pid, type(exc).__name__)
        return 0
    for d in repo.query("documents", patient_id=pid):
        if not d.get("indexed_in_pinecone"):
            repo.update("documents", d["id"], {"indexed_in_pinecone": True})
    return len(records)


def summarise_target(repo) -> str:
    from app.services.pinecone_service import get_vector_store

    return f"repository={repo.backend}, vector_store={get_vector_store().backend}"
