"""Triage / red-flag endpoint (deterministic first, optional LLM assist)."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import RepoDep
from app.schemas.triage import TriageCheckIn, TriageResult
from app.services.red_flag_service import find_red_flags, llm_safety_review, merge_triage

router = APIRouter(prefix="/triage", tags=["triage"])


@router.post("/check", response_model=TriageResult)
async def check(payload: TriageCheckIn, repo: RepoDep, use_llm: bool = False) -> TriageResult:
    rule_result = find_red_flags(payload.text, age=payload.age)
    result = rule_result
    if use_llm:
        result = merge_triage(rule_result, await llm_safety_review(payload.text))

    # If tied to a session, reflect escalation on that session + raise an alert.
    if payload.session_id and result.escalate:
        session = repo.get("clinical_sessions", payload.session_id)
        if session:
            repo.update(
                "clinical_sessions",
                payload.session_id,
                {"red_flag": True, "triage_priority": result.priority if isinstance(result.priority, str) else result.priority.value},
            )
            existing = {a.get("label") for a in repo.alerts_for_session(payload.session_id)}
            for hit in result.hits:
                if hit.label in existing:
                    continue
                repo.create(
                    "alerts",
                    {
                        "session_id": str(payload.session_id),
                        "patient_id": str(session["patient_id"]),
                        "kind": "red_flag",
                        "label": hit.label,
                        "detail": ", ".join(hit.matched_terms) or hit.category,
                        "severity": hit.severity if isinstance(hit.severity, str) else hit.severity.value,
                        "status": "open",
                        "source": hit.source,
                    },
                )
    return result
