"""Generate the physician-ready structured clinical summary.

Pipeline (per the project spec):

    current interview history
  + relevant previous records retrieved from Pinecone (patient-isolated)
  + current uploaded documents
        -> Groq -> validated structured summary  (deterministic fallback if Groq down)
        -> deterministic red-flag re-screen (never skipped)
        -> timeline + document intelligence
        -> persist to Supabase/memory + index summary back into Pinecone
"""
from __future__ import annotations

import json

from app.core.config import settings
from app.core.logging import get_logger
from app.models.entities import (
    AllergyEntity,
    ClinicalSummaryEntity,
    LabResultEntity,
    MedicalHistoryEntity,
    MedicationEntity,
)
from app.repositories.base import BaseRepository
from app.schemas.ayush import AyushAssessment
from app.schemas.clinical_history import StructuredClinicalHistory, coerce_structured_history
from app.schemas.common import SessionStatus, SummaryStatus, TriagePriority
from app.schemas.document import StructuredDocument
from app.schemas.summary import (
    AI_DRAFT_DISCLAIMER,
    ClinicalSummaryOut,
    GenerateSummaryIn,
    RetrievedContext,
)
from app.services.groq_service import GroqBadJSON, GroqUnavailable, get_groq
from app.services.pinecone_service import VectorRecord, get_vector_store
from app.services.prompts import SUMMARY_SYSTEM, summary_user_prompt
from app.services.red_flag_service import find_red_flags, merge_triage
from app.services.timeline_service import build_timeline

log = get_logger("services.summary")

_PRIORITY_ORDER = {"routine": 0, "standard": 1, "urgent": 2, "emergency": 3}


def _transcript_text(session: dict) -> str:
    return "\n".join(
        f"{t.get('role')}: {t.get('text')}" for t in (session.get("transcript") or [])
    )


def _retrieve_context(patient_id: str, query_text: str, *, top_k: int = 5) -> list[RetrievedContext]:
    store = get_vector_store()
    try:
        matches = store.query(str(patient_id), query_text or "clinical history", top_k=top_k)
    except Exception as exc:  # noqa: BLE001 - RAG is best-effort
        log.warning("RAG retrieval skipped (%s)", type(exc).__name__)
        return []
    return [
        RetrievedContext(
            chunk_id=m.id, score=round(float(m.score), 4), text=m.text,
            source=str(m.metadata.get("source", "")), metadata=m.metadata,
        )
        for m in matches
        if str(m.metadata.get("patient_id")) == str(patient_id)  # final isolation guard
    ]


def _fallback_history(session: dict, documents: list[dict], partial: dict | None) -> StructuredClinicalHistory:
    hist = coerce_structured_history(partial) if partial else StructuredClinicalHistory()
    if not hist.chief_complaint:
        hist.chief_complaint = (session.get("chief_complaint") or "").strip()

    # Fold document-derived facts in
    for d in documents:
        sd_raw = d.get("structured")
        if not sd_raw:
            continue
        try:
            sd = StructuredDocument.model_validate(sd_raw)
        except Exception:
            continue
        for dx in sd.diagnoses:
            if dx and dx not in hist.past_medical_history:
                hist.past_medical_history.append(dx)
        for m in sd.medications:
            if m.name and not any(x.name.lower() == m.name.lower() for x in hist.medications):
                hist.medications.append(_med(m.name, m.dosage, m.frequency, m.route))
        for s in sd.previous_surgeries:
            if s and s not in hist.past_surgical_history:
                hist.past_surgical_history.append(s)
        for lab in sd.lab_results:
            label = f"{lab.test_name}: {lab.value} {lab.unit}".strip()
            if label and label not in hist.previous_investigations:
                hist.previous_investigations.append(label)

    missing = []
    if not hist.history_of_present_illness.onset:
        missing.append("onset / duration")
    if not hist.history_of_present_illness.severity:
        missing.append("severity")
    if not hist.allergies:
        missing.append("drug allergies")
    if not hist.personal_history.smoking and not hist.personal_history.alcohol:
        missing.append("smoking / alcohol history")
    hist.missing_information = missing
    hist.completeness_score = max(20, 90 - 12 * len(missing))
    hist.triage_priority = session.get("triage_priority") or TriagePriority.STANDARD
    return hist


def _med(name, dosage="", frequency="", route=""):
    from app.schemas.clinical_history import MedicationItem

    return MedicationItem(name=name, dosage=dosage, frequency=frequency, route=route)


def _fallback_narrative(hist: StructuredClinicalHistory, doc_count: int, rag_count: int) -> str:
    hpi = hist.history_of_present_illness
    bits = [
        f"Patient presents with: {hist.chief_complaint or 'complaint not clearly recorded'}.",
    ]
    if hpi.onset or hpi.duration:
        bits.append(f"Onset/duration: {hpi.onset or '—'} / {hpi.duration or '—'}.")
    if hpi.character or hpi.severity:
        bits.append(f"Character {hpi.character or '—'}, severity {hpi.severity or '—'}.")
    if hpi.associated_symptoms:
        bits.append("Associated symptoms: " + ", ".join(hpi.associated_symptoms) + ".")
    if hist.past_medical_history:
        bits.append("Relevant PMH: " + ", ".join(hist.past_medical_history) + ".")
    if hist.medications:
        bits.append("Current medications: " + ", ".join(m.name for m in hist.medications if m.name) + ".")
    if hist.allergies:
        bits.append("Allergies: " + ", ".join(hist.allergies) + ".")
    bits.append(
        f"Compiled from the intake interview, {doc_count} uploaded document(s) and "
        f"{rag_count} retrieved prior record(s). {AI_DRAFT_DISCLAIMER}"
    )
    return " ".join(bits)


async def generate_summary(repo: BaseRepository, payload: GenerateSummaryIn) -> ClinicalSummaryOut:
    session, patient = repo.session_with_patient(payload.session_id)
    repo.ensure_owned(session, payload.patient_id, table="clinical_sessions")

    documents = repo.documents_for_session(payload.session_id, payload.patient_id) if payload.include_documents else []
    structured_docs = [d.get("structured") for d in documents if d.get("structured")]
    partial = session.get("partial_history")

    query_text = " ".join(
        [session.get("chief_complaint") or "", _transcript_text(session)[-1500:]]
    ).strip()
    retrieved = _retrieve_context(str(payload.patient_id), query_text) if payload.include_rag else []

    rule_triage = find_red_flags(
        _transcript_text(session) + "\n" + json.dumps(structured_docs, default=str),
        age=patient.get("age"),
    )

    groq = get_groq()
    used_fallback = True
    model_name = ""
    narrative = ""
    history = StructuredClinicalHistory()

    if groq.available:
        try:
            data = await groq.chat_json(
                SUMMARY_SYSTEM,
                summary_user_prompt(
                    language=session.get("language") or "en",
                    transcript=session.get("transcript") or [],
                    interview_history=partial,
                    documents=[
                        {"filename": d.get("filename"), "structured": d.get("structured")}
                        for d in documents
                    ],
                    retrieved=[{"text": r.text, "source": r.source, "score": r.score} for r in retrieved],
                    rule_red_flags=[h.label for h in rule_triage.hits],
                ),
                temperature=0.2,
                max_tokens=2600,
            )
            narrative = str(data.pop("narrative", "")).strip()
            history = coerce_structured_history(data)
            used_fallback = False
            model_name = settings.groq_model
        except (GroqUnavailable, GroqBadJSON) as exc:
            log.info("Summary LLM fallback (%s)", type(exc).__name__)

    if used_fallback:
        history = _fallback_history(session, documents, partial)
        narrative = _fallback_narrative(history, len(documents), len(retrieved))

    # Deterministic red-flag layer ALWAYS wins on escalation
    combined = merge_triage(
        rule_triage,
        find_red_flags(narrative + "\n" + " ".join(history.red_flags), age=patient.get("age")),
    )
    for h in combined.hits:
        if h.label not in history.red_flags:
            history.red_flags.append(h.label)
    priority_candidates = [
        history.triage_priority if isinstance(history.triage_priority, str) else history.triage_priority.value,
        combined.priority if isinstance(combined.priority, str) else combined.priority.value,
        session.get("triage_priority") or "standard",
    ]
    final_priority = max(priority_candidates, key=lambda p: _PRIORITY_ORDER.get(p, 1))
    history.triage_priority = final_priority

    # Document intelligence + timeline
    doc_intel: list[StructuredDocument] = []
    for raw in structured_docs:
        try:
            doc_intel.append(StructuredDocument.model_validate(raw))
        except Exception:
            continue
    timeline = build_timeline(
        patient_id=str(payload.patient_id),
        documents=documents,
        chief_complaint=session.get("chief_complaint") or "",
    ).events

    ayush = None
    ayush_rows = repo.query("ayush_assessments", session_id=str(payload.session_id))
    if ayush_rows:
        try:
            ayush = AyushAssessment.model_validate(ayush_rows[-1].get("assessment") or {})
        except Exception:
            ayush = None

    # ---- persist -------------------------------------------------------------
    entity = ClinicalSummaryEntity(
        session_id=payload.session_id,
        patient_id=payload.patient_id,
        status=SummaryStatus.DRAFT,
        narrative=narrative,
        history=history.model_dump(mode="json"),
        document_intelligence=[d.model_dump(mode="json") for d in doc_intel],
        timeline=[t.model_dump(mode="json") for t in timeline],
        ayush_assessment=ayush.model_dump(mode="json") if ayush else None,
        red_flags=history.red_flags,
        attention_points=history.doctor_attention_points,
        triage_priority=final_priority,
        retrieved_context=[r.model_dump(mode="json") for r in retrieved],
        used_llm_fallback=used_fallback,
        model_name=model_name,
    )
    existing = repo.summary_for_session(payload.session_id)
    if existing:
        row = repo.update("clinical_summaries", existing["id"], entity.model_dump(mode="json", exclude={"id", "created_at"}))
    else:
        row = repo.create("clinical_summaries", entity)

    repo.create(
        "medical_histories",
        MedicalHistoryEntity(
            patient_id=payload.patient_id,
            session_id=payload.session_id,
            structured=history.model_dump(mode="json"),
            completeness_score=history.completeness_score,
        ),
    )
    _persist_extractions(repo, payload.patient_id, payload.session_id, history, doc_intel)

    # ---- index summary back into Pinecone for future visits ----------------
    try:
        get_vector_store().upsert(
            str(payload.patient_id),
            [
                VectorRecord(
                    id=f"summary::{row['id']}",
                    text=f"Clinical summary ({session.get('chief_complaint','')}): {narrative}",
                    metadata={
                        "patient_id": str(payload.patient_id),
                        "session_id": str(payload.session_id),
                        "kind": "clinical_summary",
                        "source": "clinical_summary",
                    },
                )
            ],
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Summary indexing skipped (%s)", type(exc).__name__)

    repo.update(
        "clinical_sessions",
        payload.session_id,
        {"status": SessionStatus.SUMMARY_READY.value, "triage_priority": final_priority,
         "red_flag": bool(combined.red_flag or session.get("red_flag"))},
    )

    return _to_out(row)


def _persist_extractions(repo, patient_id, session_id, history: StructuredClinicalHistory, docs: list[StructuredDocument]):
    for m in history.medications:
        if m.name:
            repo.create("medications", MedicationEntity(
                patient_id=patient_id, session_id=session_id, name=m.name, dosage=m.dosage,
                frequency=m.frequency, route=m.route, indication=m.indication, source="summary"))
    for a in history.allergies:
        repo.create("allergies", AllergyEntity(patient_id=patient_id, session_id=session_id, substance=a, source="summary"))
    for d in docs:
        for lab in d.lab_results:
            if lab.test_name:
                repo.create("lab_results", LabResultEntity(
                    patient_id=patient_id, session_id=session_id, test_name=lab.test_name,
                    value=lab.value, unit=lab.unit, reference_range=lab.reference_range,
                    flag=lab.flag, observed_at=lab.observed_at))


def _to_out(row: dict) -> ClinicalSummaryOut:
    return ClinicalSummaryOut(
        id=row["id"],
        session_id=row["session_id"],
        patient_id=row["patient_id"],
        status=row.get("status", SummaryStatus.DRAFT.value),
        disclaimer=AI_DRAFT_DISCLAIMER,
        narrative=row.get("narrative", ""),
        history=StructuredClinicalHistory.model_validate(row.get("history") or {}),
        document_intelligence=[StructuredDocument.model_validate(d) for d in row.get("document_intelligence") or []],
        timeline=row.get("timeline") or [],
        ayush_assessment=(AyushAssessment.model_validate(row["ayush_assessment"]) if row.get("ayush_assessment") else None),
        red_flags=row.get("red_flags") or [],
        attention_points=row.get("attention_points") or [],
        triage_priority=row.get("triage_priority", TriagePriority.STANDARD.value),
        retrieved_context=[RetrievedContext.model_validate(r) for r in row.get("retrieved_context") or []],
        used_llm_fallback=row.get("used_llm_fallback", False),
        model_name=row.get("model_name", ""),
        doctor_notes=row.get("doctor_notes", ""),
        edited_history=(StructuredClinicalHistory.model_validate(row["edited_history"]) if row.get("edited_history") else None),
        reviewed_by=row.get("reviewed_by"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        confirmed_at=row.get("confirmed_at"),
    )


def summary_to_out(row: dict) -> ClinicalSummaryOut:
    return _to_out(row)
