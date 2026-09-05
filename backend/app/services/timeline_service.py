"""Build a chronological medical timeline from structured documents + the visit.

Dates arrive in many shapes ("2024", "Jan 2025", "14/03/2025", "2025-03-14").
:func:`normalise_date` produces a best-effort ``YYYY-MM-DD`` sort key while the
original string is kept for display.
"""
from __future__ import annotations

import re
from datetime import datetime

from app.schemas.document import StructuredDocument
from app.schemas.timeline import TimelineEvent, TimelineOut

_MONTHS = {
    m.lower(): i
    for i, m in enumerate(
        [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ],
        start=1,
    )
}
_MONTHS.update({k[:3]: v for k, v in list(_MONTHS.items())})


def normalise_date(raw: str | None) -> tuple[str, str]:
    """Return (display, sort_key). sort_key is '' when unparseable."""
    if not raw:
        return "", ""
    text = str(raw).strip()
    low = text.lower()

    # ISO-ish 2025-03-14 / 2025/03/14
    m = re.search(r"\b(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?\b", text)
    if m:
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(3) or 1)
        if 1 <= mo <= 12:
            return text, f"{y}-{mo:02d}-{min(max(d,1),28):02d}"

    # 14/03/2025 or 14-03-2025 (day first)
    m = re.search(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b", text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        y = ("20" + y) if len(y) == 2 else y
        if mo > 12 and d <= 12:
            d, mo = mo, d
        if 1 <= mo <= 12:
            return text, f"{y}-{mo:02d}-{min(max(d,1),28):02d}"

    # "Jan 2025", "March 2025", "Jan 14, 2025"
    m = re.search(r"([a-z]{3,9})\.?\s+(\d{1,2})?,?\s*(\d{4})", low)
    if m and m.group(1) in _MONTHS:
        mo = _MONTHS[m.group(1)]
        d = int(m.group(2) or 1)
        return text, f"{m.group(3)}-{mo:02d}-{min(max(d,1),28):02d}"

    # bare year
    m = re.search(r"\b(19|20)\d{2}\b", text)
    if m:
        return text, f"{m.group(0)}-01-01"

    return text, ""


def _events_from_document(doc: StructuredDocument, *, source: str, doc_id: str | None) -> list[TimelineEvent]:
    display, sort_key = normalise_date(doc.document_date)
    base_date = display or "(undated)"
    events: list[TimelineEvent] = []

    for dx in doc.diagnoses:
        events.append(TimelineEvent(date=base_date, sort_key=sort_key, title=dx,
                                    detail="Diagnosis noted in document", category="diagnosis",
                                    source=source, source_document_id=doc_id))
    for med in doc.medications:
        label = med.name or "Medication"
        detail = " ".join(x for x in [med.dosage, med.frequency, med.route] if x).strip()
        events.append(TimelineEvent(date=base_date, sort_key=sort_key, title=f"{label} recorded",
                                    detail=detail or "Prescribed / listed", category="medication",
                                    source=source, source_document_id=doc_id))
    for lab in doc.lab_results:
        val = " ".join(x for x in [lab.value, lab.unit] if x).strip()
        ref = f" (ref {lab.reference_range})" if lab.reference_range else ""
        events.append(TimelineEvent(date=base_date, sort_key=sort_key,
                                    title=f"{lab.test_name or 'Lab test'}: {val}{ref}".strip(),
                                    detail=(lab.flag or "").upper(), category="lab",
                                    source=source, source_document_id=doc_id))
    for proc in doc.procedures + doc.previous_surgeries:
        events.append(TimelineEvent(date=base_date, sort_key=sort_key, title=proc,
                                    detail="Procedure / surgery", category="procedure",
                                    source=source, source_document_id=doc_id))
    if not events and (doc.important_notes or doc.follow_up):
        events.append(TimelineEvent(date=base_date, sort_key=sort_key,
                                    title=doc.document_type.replace("_", " ").title(),
                                    detail="; ".join(doc.important_notes) or doc.follow_up,
                                    category="visit", source=source, source_document_id=doc_id))
    return events


def build_timeline(
    *,
    patient_id: str,
    documents: list[dict],
    chief_complaint: str = "",
    visit_date: datetime | None = None,
) -> TimelineOut:
    events: list[TimelineEvent] = []
    sources: list[str] = []

    for d in documents:
        structured = d.get("structured")
        if not structured:
            continue
        try:
            sd = StructuredDocument.model_validate(structured)
        except Exception:
            continue
        src = d.get("filename") or "document"
        sources.append(src)
        events.extend(_events_from_document(sd, source=src, doc_id=str(d.get("id") or "") or None))

    # Current visit marker
    vd = visit_date or datetime.utcnow()
    events.append(
        TimelineEvent(
            date=vd.strftime("%b %Y"),
            sort_key=vd.strftime("%Y-%m-%d"),
            title="Current visit",
            detail=chief_complaint or "Clinical intake submitted",
            category="visit",
            source="current-visit",
        )
    )

    # Undated events sink to the top (oldest) but keep stable order otherwise.
    events.sort(key=lambda e: (e.sort_key or "0000-00-00", e.category))
    return TimelineOut(patient_id=str(patient_id), events=events, generated_from=sorted(set(sources)))
