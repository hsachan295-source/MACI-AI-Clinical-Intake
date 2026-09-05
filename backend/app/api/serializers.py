"""Row (dict) -> response-schema converters."""
from __future__ import annotations

from app.schemas.patient import ConsentOut, PatientOut
from app.schemas.session import SessionOut


def patient_out(row: dict) -> PatientOut:
    return PatientOut(
        id=row["id"],
        full_name=row.get("full_name", ""),
        age=row.get("age"),
        gender=row.get("gender", "undisclosed"),
        preferred_language=row.get("preferred_language", "en"),
        phone=row.get("phone"),
        abha_id=row.get("abha_id"),
        mrn=row.get("mrn"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def consent_out(row: dict) -> ConsentOut:
    return ConsentOut(
        id=row["id"],
        patient_id=row["patient_id"],
        session_id=row.get("session_id"),
        consent_text_version=row.get("consent_text_version", "v1"),
        data_processing=row.get("data_processing", True),
        ai_assistance=row.get("ai_assistance", True),
        share_with_clinician=row.get("share_with_clinician", True),
        channel=row.get("channel", "kiosk"),
        created_at=row.get("created_at"),
    )


def session_out(row: dict) -> SessionOut:
    return SessionOut(
        id=row["id"],
        patient_id=row["patient_id"],
        language=row.get("language", "en"),
        mode=row.get("mode", "text"),
        clinical_mode=row.get("clinical_mode", "general"),
        department=row.get("department"),
        chief_complaint=row.get("chief_complaint"),
        status=row.get("status", "created"),
        triage_priority=row.get("triage_priority", "standard"),
        red_flag=bool(row.get("red_flag")),
        question_count=int(row.get("question_count") or 0),
        completion_pct=int(row.get("completion_pct") or 0),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        submitted_at=row.get("submitted_at"),
        reviewed_at=row.get("reviewed_at"),
    )
