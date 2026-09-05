"""Clinical summary review endpoints (edit / confirm / reject)."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import RepoDep
from app.schemas.common import SummaryStatus
from app.schemas.summary import (
    ClinicalSummaryOut,
    SummaryConfirmIn,
    SummaryPatch,
)
from app.services.summary_service import summary_to_out

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.get("/{summary_id}", response_model=ClinicalSummaryOut)
def get_summary(summary_id: UUID, repo: RepoDep) -> ClinicalSummaryOut:
    return summary_to_out(repo.get_or_404("clinical_summaries", summary_id, label="summary"))


@router.patch("/{summary_id}", response_model=ClinicalSummaryOut)
def patch_summary(summary_id: UUID, payload: SummaryPatch, repo: RepoDep) -> ClinicalSummaryOut:
    row = repo.get_or_404("clinical_summaries", summary_id, label="summary")
    patch = payload.model_dump(exclude_none=True, mode="json")
    if not patch:
        return summary_to_out(row)

    # Editing implies a clinician touched it - reflect that unless explicitly set.
    if "status" not in patch and row.get("status") != SummaryStatus.CONFIRMED.value:
        patch["status"] = SummaryStatus.EDITED.value
    updated = repo.update("clinical_summaries", summary_id, patch)
    return summary_to_out(updated)


@router.post("/{summary_id}/confirm", response_model=ClinicalSummaryOut)
def confirm_summary(summary_id: UUID, payload: SummaryConfirmIn, repo: RepoDep) -> ClinicalSummaryOut:
    row = repo.get_or_404("clinical_summaries", summary_id, label="summary")
    patch: dict = {
        "status": SummaryStatus.CONFIRMED.value,
        "reviewed_by": payload.reviewed_by,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.doctor_notes:
        existing = (row.get("doctor_notes") or "").strip()
        patch["doctor_notes"] = (existing + "\n" + payload.doctor_notes).strip() if existing else payload.doctor_notes
    if payload.accept_history and row.get("edited_history"):
        patch["history"] = row["edited_history"]
    updated = repo.update("clinical_summaries", summary_id, patch)
    return summary_to_out(updated)


@router.post("/{summary_id}/reject", response_model=ClinicalSummaryOut)
def reject_summary(summary_id: UUID, payload: SummaryConfirmIn, repo: RepoDep) -> ClinicalSummaryOut:
    repo.get_or_404("clinical_summaries", summary_id, label="summary")
    updated = repo.update(
        "clinical_summaries",
        summary_id,
        {
            "status": SummaryStatus.REJECTED.value,
            "reviewed_by": payload.reviewed_by,
            "doctor_notes": payload.doctor_notes,
        },
    )
    return summary_to_out(updated)
