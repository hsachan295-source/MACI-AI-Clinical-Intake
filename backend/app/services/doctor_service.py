"""Doctor dashboard aggregation: queue, patient view, analytics."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from uuid import UUID

from app.core.errors import NotFoundError
from app.repositories.base import BaseRepository
from app.schemas.ayush import AyushAssessment
from app.schemas.common import SessionStatus, TriagePriority
from app.schemas.doctor import (
    AnalyticsBucket,
    DoctorAnalyticsOut,
    DoctorPatientSummaryOut,
    DoctorQueueOut,
    MarkReviewedIn,
    PatientOverview,
    QueueItem,
)
from app.services.summary_service import summary_to_out
from app.services.document_service import document_to_out
from app.services.timeline_service import build_timeline

_PRIORITY_ORDER = {
    TriagePriority.EMERGENCY.value: 0,
    TriagePriority.URGENT.value: 1,
    TriagePriority.STANDARD.value: 2,
    TriagePriority.ROUTINE.value: 3,
}
_ACTIVE_STATUSES = {
    SessionStatus.IN_PROGRESS.value,
    SessionStatus.AWAITING_DOCUMENTS.value,
    SessionStatus.SUMMARY_READY.value,
    SessionStatus.SUBMITTED.value,
}

_COMPLAINT_CATEGORIES = {
    "chest": "Cardiac / Chest",
    "heart": "Cardiac / Chest",
    "breath": "Respiratory",
    "cough": "Respiratory",
    "fever": "Infection / Fever",
    "head": "Neurological",
    "dizz": "Neurological",
    "abdom": "Gastrointestinal",
    "stomach": "Gastrointestinal",
    "vomit": "Gastrointestinal",
    "diarr": "Gastrointestinal",
    "back": "Musculoskeletal",
    "joint": "Musculoskeletal",
    "knee": "Musculoskeletal",
    "skin": "Dermatology",
    "rash": "Dermatology",
    "anx": "Mental health",
    "sleep": "Mental health",
    "sugar": "Endocrine / Metabolic",
    "diabet": "Endocrine / Metabolic",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _waiting_minutes(session: dict) -> int:
    ref = _parse_dt(session.get("submitted_at")) or _parse_dt(session.get("created_at"))
    if not ref:
        return 0
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    return max(0, int((_now() - ref).total_seconds() // 60))


def _categorise(complaint: str) -> str:
    low = (complaint or "").lower()
    for key, label in _COMPLAINT_CATEGORIES.items():
        if key in low:
            return label
    return "Other / General"


def get_queue(
    repo: BaseRepository, *, include_reviewed: bool = False, priority: str | None = None
) -> DoctorQueueOut:
    sessions = repo.list("clinical_sessions")
    patients = {p["id"]: p for p in repo.list("patients")}
    summaries_by_session: dict[str, dict] = {}
    for s in repo.list("clinical_summaries"):
        summaries_by_session[str(s["session_id"])] = s

    items: list[QueueItem] = []
    for s in sessions:
        status = s.get("status")
        if status == SessionStatus.CANCELLED.value:
            continue
        if not include_reviewed and status == SessionStatus.REVIEWED.value:
            continue
        if include_reviewed and status not in _ACTIVE_STATUSES | {SessionStatus.REVIEWED.value}:
            continue
        if not include_reviewed and status not in _ACTIVE_STATUSES:
            continue
        if priority and s.get("triage_priority") != priority:
            continue
        p = patients.get(s["patient_id"], {})
        summ = summaries_by_session.get(str(s["id"]))
        items.append(
            QueueItem(
                session_id=s["id"],
                patient_id=s["patient_id"],
                patient_name=p.get("full_name", "Unknown patient"),
                age=p.get("age"),
                gender=p.get("gender", "undisclosed"),
                language=s.get("language", "en"),
                clinical_mode=s.get("clinical_mode", "general"),
                chief_complaint=s.get("chief_complaint") or "",
                status=status,
                triage_priority=s.get("triage_priority", TriagePriority.STANDARD.value),
                red_flag=bool(s.get("red_flag")),
                completion_pct=int(s.get("completion_pct") or 0),
                has_summary=summ is not None,
                summary_status=(summ or {}).get("status"),
                submitted_at=_parse_dt(s.get("submitted_at")),
                waiting_minutes=_waiting_minutes(s),
                created_at=_parse_dt(s.get("created_at")),
            )
        )

    items.sort(
        key=lambda i: (
            _PRIORITY_ORDER.get(i.triage_priority, 2),
            0 if i.red_flag else 1,
            -(i.waiting_minutes),
        )
    )
    return DoctorQueueOut(items=items, total=len(items))


def _latest_session_for_patient(repo: BaseRepository, patient_id: UUID) -> dict:
    rows = repo.query_for_patient("clinical_sessions", patient_id)
    if not rows:
        raise NotFoundError("No intake session found for this patient")
    return sorted(rows, key=lambda r: r.get("created_at") or "")[-1]


def get_patient_summary(
    repo: BaseRepository, *, patient_id: UUID, session_id: UUID | None = None
) -> DoctorPatientSummaryOut:
    patient = repo.get_or_404("patients", patient_id, label="patient")
    if session_id:
        session = repo.get_or_404("clinical_sessions", session_id, label="session")
        repo.ensure_owned(session, patient_id, table="clinical_sessions")
    else:
        session = _latest_session_for_patient(repo, patient_id)

    documents = repo.documents_for_session(session["id"], patient_id)
    summary_row = repo.summary_for_session(session["id"])
    timeline = build_timeline(
        patient_id=str(patient_id),
        documents=documents,
        chief_complaint=session.get("chief_complaint") or "",
    ).events

    ayush = None
    ayush_rows = repo.query("ayush_assessments", session_id=str(session["id"]))
    if ayush_rows:
        try:
            ayush = AyushAssessment.model_validate(ayush_rows[-1].get("assessment") or {})
        except Exception:
            ayush = None

    overview = PatientOverview(
        patient_id=patient["id"],
        full_name=patient.get("full_name", ""),
        age=patient.get("age"),
        gender=patient.get("gender", "undisclosed"),
        preferred_language=patient.get("preferred_language", "en"),
        chief_complaint=session.get("chief_complaint") or "",
        abha_id=patient.get("abha_id"),
        mrn=patient.get("mrn"),
    )
    return DoctorPatientSummaryOut(
        overview=overview,
        session_id=session["id"],
        session_status=session.get("status", SessionStatus.CREATED.value),
        triage_priority=session.get("triage_priority", TriagePriority.STANDARD.value),
        red_flag=bool(session.get("red_flag")),
        summary=summary_to_out(summary_row) if summary_row else None,
        documents=[document_to_out(d) for d in documents],
        timeline=timeline,
        ayush_assessment=ayush,
        transcript_available=bool(session.get("transcript")),
    )


def get_analytics(repo: BaseRepository) -> DoctorAnalyticsOut:
    sessions = repo.list("clinical_sessions")
    today = _now().date()

    patients_today = waiting = high_priority = completed = reviewed_today = 0
    intake_durations: list[float] = []
    complaint_counter: Counter = Counter()
    priority_counter: Counter = Counter()
    hour_counter: Counter = Counter()

    for s in sessions:
        created = _parse_dt(s.get("created_at"))
        if created and created.date() == today:
            patients_today += 1
            hour_counter[created.strftime("%H:00")] += 1
        status = s.get("status")
        if status in _ACTIVE_STATUSES:
            waiting += 1
        if s.get("triage_priority") in (TriagePriority.URGENT.value, TriagePriority.EMERGENCY.value):
            high_priority += 1
        if int(s.get("completion_pct") or 0) >= 100 or status in (
            SessionStatus.SUMMARY_READY.value, SessionStatus.SUBMITTED.value, SessionStatus.REVIEWED.value
        ):
            completed += 1
        reviewed = _parse_dt(s.get("reviewed_at"))
        if reviewed and reviewed.date() == today:
            reviewed_today += 1
        submitted = _parse_dt(s.get("submitted_at"))
        if created and submitted:
            mins = (submitted - created).total_seconds() / 60
            if 0 < mins < 600:
                intake_durations.append(mins)
        complaint_counter[_categorise(s.get("chief_complaint") or "")] += 1
        priority_counter[s.get("triage_priority", TriagePriority.STANDARD.value)] += 1

    avg = round(sum(intake_durations) / len(intake_durations), 1) if intake_durations else 0.0

    return DoctorAnalyticsOut(
        patients_today=patients_today,
        waiting=waiting,
        high_priority=high_priority,
        completed_intake=completed,
        reviewed_today=reviewed_today,
        average_intake_minutes=avg,
        by_complaint_category=[AnalyticsBucket(label=k, value=v) for k, v in complaint_counter.most_common()],
        by_priority=[
            AnalyticsBucket(label=k, value=priority_counter.get(k, 0))
            for k in (
                TriagePriority.EMERGENCY.value,
                TriagePriority.URGENT.value,
                TriagePriority.STANDARD.value,
                TriagePriority.ROUTINE.value,
            )
        ],
        intake_activity_by_hour=[
            AnalyticsBucket(label=f"{h:02d}:00", value=hour_counter.get(f"{h:02d}:00", 0))
            for h in range(7, 21)
        ],
    )


def mark_reviewed(repo: BaseRepository, *, session_id: UUID, payload: MarkReviewedIn) -> dict:
    session = repo.get_or_404("clinical_sessions", session_id, label="session")
    repo.update(
        "clinical_sessions",
        session_id,
        {
            "status": SessionStatus.REVIEWED.value,
            "reviewed_at": _now().isoformat(),
            "reviewed_by": payload.reviewed_by,
        },
    )
    summary_row = repo.summary_for_session(session_id)
    if summary_row and payload.notes:
        notes = (summary_row.get("doctor_notes") or "").strip()
        merged = (notes + "\n" + payload.notes).strip() if notes else payload.notes
        repo.update("clinical_summaries", summary_row["id"], {"doctor_notes": merged})
    for alert in repo.alerts_for_session(session_id):
        if alert.get("status") == "open":
            repo.update("alerts", alert["id"], {"status": "acknowledged", "acknowledged_by": payload.reviewed_by})
    return {"session_id": str(session_id), "status": SessionStatus.REVIEWED.value, "reviewed_by": payload.reviewed_by}
