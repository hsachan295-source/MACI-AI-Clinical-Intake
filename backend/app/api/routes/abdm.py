"""ABDM / ABHA endpoints - FUTURE / SANDBOX stubs.

These never contact a real ABDM gateway. They exist so the integration surface
is stable for later work. The prototype runs without any ABDM credentials.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import RepoDep
from app.services.abdm_service import get_abdm

router = APIRouter(prefix="/abdm", tags=["abdm (future/sandbox)"])


class AbhaLookupIn(BaseModel):
    abha_id: str | None = None
    mobile: str | None = None


class ConsentRequestIn(BaseModel):
    patient_id: str
    purpose: str = "OPConsultation"
    hi_types: list[str] | None = None


@router.get("/status")
def abdm_status() -> dict:
    return get_abdm().status().__dict__


@router.post("/abha/lookup")
def abha_lookup(payload: AbhaLookupIn) -> dict:
    return get_abdm().lookup_abha(payload.abha_id, mobile=payload.mobile).__dict__


@router.post("/consent")
def abdm_consent(payload: ConsentRequestIn) -> dict:
    return get_abdm().request_consent(
        patient_id=payload.patient_id, purpose=payload.purpose, hi_types=payload.hi_types
    ).__dict__


@router.get("/fhir/{session_id}")
def abdm_fhir_export(session_id: UUID, repo: RepoDep) -> dict:
    session, patient = repo.session_with_patient(session_id)
    summary = repo.summary_for_session(session_id)
    documents = repo.documents_for_session(session_id, patient["id"])
    bundle = get_abdm().to_fhir_bundle(patient=patient, summary=summary, documents=documents)
    return {
        "integration_status": "future-sandbox",
        "note": "Locally generated illustrative FHIR skeleton. Not validated, not transmitted.",
        "bundle": bundle,
    }


@router.post("/his/push/{session_id}")
def abdm_his_push(session_id: UUID, repo: RepoDep) -> dict:
    session, patient = repo.session_with_patient(session_id)
    summary = repo.summary_for_session(session_id)
    documents = repo.documents_for_session(session_id, patient["id"])
    bundle = get_abdm().to_fhir_bundle(patient=patient, summary=summary, documents=documents)
    return get_abdm().push_to_his(bundle=bundle).__dict__
