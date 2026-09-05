"""Patient + consent endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import RepoDep
from app.api.serializers import consent_out, patient_out
from app.models.entities import ConsentEntity, PatientEntity
from app.schemas.patient import (
    ConsentCreate,
    ConsentOut,
    PatientCreate,
    PatientOut,
    PatientUpdate,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, repo: RepoDep) -> PatientOut:
    entity = PatientEntity(**payload.model_dump())
    row = repo.create("patients", entity)
    return patient_out(row)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: UUID, repo: RepoDep) -> PatientOut:
    return patient_out(repo.get_or_404("patients", patient_id, label="patient"))


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: UUID, payload: PatientUpdate, repo: RepoDep) -> PatientOut:
    repo.get_or_404("patients", patient_id, label="patient")
    patch = payload.model_dump(exclude_none=True)
    row = repo.update("patients", patient_id, patch) if patch else repo.get("patients", patient_id)
    return patient_out(row)


@router.post("/{patient_id}/consent", response_model=ConsentOut, status_code=status.HTTP_201_CREATED)
def record_consent(patient_id: UUID, payload: ConsentCreate, repo: RepoDep) -> ConsentOut:
    repo.get_or_404("patients", patient_id, label="patient")
    data = payload.model_dump()
    data["patient_id"] = patient_id
    row = repo.create("consents", ConsentEntity(**data))
    return consent_out(row)


@router.get("/{patient_id}/consent", response_model=list[ConsentOut])
def list_consents(patient_id: UUID, repo: RepoDep) -> list[ConsentOut]:
    rows = repo.query_for_patient("consents", patient_id)
    return [consent_out(r) for r in rows]
