"""Document upload / OCR / structured extraction endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, File, Form, UploadFile, status

from app.api.deps import RepoDep
from app.core.config import settings
from app.core.errors import FileValidationError
from app.schemas.common import DocumentType
from app.schemas.document import (
    DocumentCorrectionIn,
    DocumentOut,
    DocumentProcessOut,
)
from app.services.document_service import (
    apply_correction,
    create_document,
    document_to_out,
    process_document,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    repo: RepoDep,
    session_id: UUID = Form(...),
    patient_id: UUID = Form(...),
    document_type: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> DocumentOut:
    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise FileValidationError(
            f"File exceeds the {settings.max_upload_mb} MB limit",
            details={"max_mb": settings.max_upload_mb},
        )
    dtype = None
    if document_type:
        try:
            dtype = DocumentType(document_type)
        except ValueError:
            dtype = DocumentType.OTHER
    return await create_document(
        repo,
        session_id=session_id,
        patient_id=patient_id,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        document_type=dtype,
    )


@router.post("/{document_id}/process", response_model=DocumentProcessOut)
async def process(document_id: UUID, patient_id: UUID, repo: RepoDep) -> DocumentProcessOut:
    """Run OCR + structured extraction. ``patient_id`` is required and enforced."""
    return await process_document(repo, document_id=document_id, patient_id=patient_id)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: UUID, patient_id: UUID, repo: RepoDep) -> DocumentOut:
    row = repo.get_or_404("documents", document_id, label="document")
    repo.ensure_owned(row, patient_id, table="documents")
    return document_to_out(row)


@router.get("", response_model=list[DocumentOut])
def list_documents(session_id: UUID, patient_id: UUID, repo: RepoDep) -> list[DocumentOut]:
    rows = repo.documents_for_session(session_id, patient_id)
    return [document_to_out(r) for r in rows]


@router.patch("/{document_id}", response_model=DocumentOut)
async def correct_document(
    document_id: UUID, patient_id: UUID, payload: DocumentCorrectionIn, repo: RepoDep
) -> DocumentOut:
    """Doctor/patient correction of OCR text or structured fields."""
    return await apply_correction(
        repo, document_id=document_id, patient_id=patient_id, correction=payload
    )
