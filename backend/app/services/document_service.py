"""Document pipeline: validate -> store -> OCR -> structure -> index.

Every step degrades gracefully:
* OCR unavailable / empty      -> document saved, status ``failed`` w/ message,
                                  user can paste text via the correction endpoint
* Groq unavailable             -> heuristic structured extraction from OCR text
* Pinecone unavailable         -> chunks skipped, pipeline still completes
"""
from __future__ import annotations

import re
import unicodedata
from uuid import UUID, uuid4

from app.core.config import settings
from app.core.errors import FileValidationError, NotFoundError
from app.core.logging import get_logger
from app.models.entities import (
    DocumentEntity,
    LabResultEntity,
    MedicationEntity,
    OcrResultEntity,
)
from app.repositories.base import BaseRepository
from app.schemas.common import DocumentStatus, DocumentType
from app.schemas.document import (
    DocumentCorrectionIn,
    DocumentOut,
    DocumentProcessOut,
    LabResultExtract,
    MedicationExtract,
    StructuredDocument,
)
from app.services.groq_service import GroqBadJSON, GroqUnavailable, get_groq
from app.services.pinecone_service import VectorRecord, get_vector_store
from app.services.prompts import DOC_STRUCTURE_SYSTEM, doc_structure_user_prompt

log = get_logger("services.document")

ALLOWED_EXT = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff", ".bmp",
    ".txt", ".md", ".csv", ".json",
}
ALLOWED_MIME_PREFIXES = ("image/",)
ALLOWED_MIME = {
    "application/pdf", "text/plain", "text/markdown", "text/csv",
    "application/json", "application/octet-stream", "",
}

_DOC_TYPE_HINTS = [
    (DocumentType.DISCHARGE_SUMMARY, ("discharge summary", "discharge note", "date of discharge", "admission date")),
    (DocumentType.LAB_REPORT, ("laboratory", "lab report", "haemoglobin", "hemoglobin", "reference range", "specimen", "hba1c", "creatinine")),
    (DocumentType.PRESCRIPTION, ("rx", "prescription", "tab.", "cap.", "sig:", "take one", "twice daily", "1-0-1")),
    (DocumentType.IMAGING_REPORT, ("x-ray", "x ray", "ultrasound", "ct scan", "mri", "impression:", "radiologist")),
    (DocumentType.REFERRAL, ("referral", "kindly see", "refer to", "please evaluate")),
]


def safe_filename(name: str) -> str:
    name = unicodedata.normalize("NFKD", name or "upload").encode("ascii", "ignore").decode()
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or "upload"
    return name[:120]


def validate_upload(*, filename: str, content_type: str, size_bytes: int) -> None:
    if size_bytes <= 0:
        raise FileValidationError("Uploaded file is empty")
    if size_bytes > settings.max_upload_bytes:
        raise FileValidationError(
            f"File exceeds the {settings.max_upload_mb} MB limit",
            details={"max_mb": settings.max_upload_mb},
        )
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise FileValidationError(
            "Unsupported file type. Allowed: PDF, PNG, JPG, GIF, TIFF, BMP, TXT, CSV, JSON, MD",
            details={"extension": ext},
        )
    ctype = (content_type or "").split(";")[0].strip().lower()
    if ctype and not (ctype in ALLOWED_MIME or ctype.startswith(ALLOWED_MIME_PREFIXES)):
        raise FileValidationError("File MIME type is not allowed", details={"content_type": ctype})


async def create_document(
    repo: BaseRepository,
    *,
    session_id: UUID,
    patient_id: UUID,
    filename: str,
    content_type: str,
    data: bytes,
    document_type: DocumentType | None = None,
) -> DocumentOut:
    session, _ = repo.session_with_patient(session_id)
    repo.ensure_owned(session, patient_id, table="clinical_sessions")
    validate_upload(filename=filename, content_type=content_type, size_bytes=len(data))

    doc_id = uuid4()
    stored = settings.upload_path / f"{doc_id}__{safe_filename(filename)}"
    try:
        stored.write_bytes(data)
        stored_path = str(stored)
    except OSError as exc:  # pragma: no cover - disk issues
        log.warning("Could not persist upload to disk: %s", type(exc).__name__)
        stored_path = None

    entity = DocumentEntity(
        id=doc_id,
        session_id=session_id,
        patient_id=patient_id,
        filename=safe_filename(filename),
        stored_path=stored_path,
        content_type=content_type or "application/octet-stream",
        size_bytes=len(data),
        document_type=document_type or DocumentType.OTHER,
        status=DocumentStatus.UPLOADED,
    )
    row = repo.create("documents", entity)
    return _to_out(row)


async def process_document(
    repo: BaseRepository, *, document_id: UUID, patient_id: UUID
) -> DocumentProcessOut:
    row = repo.get_or_404("documents", document_id, label="document")
    repo.ensure_owned(row, patient_id, table="documents")

    data = _load_bytes(row)
    if data is None:
        repo.update("documents", document_id, {"status": DocumentStatus.FAILED.value,
                                               "error": "Stored file could not be read for processing"})
        return DocumentProcessOut(document=_to_out(repo.get("documents", document_id)),
                                  message="Stored file unavailable")

    repo.update("documents", document_id, {"status": DocumentStatus.OCR_RUNNING.value})

    from app.services.ocr_service import get_ocr

    ocr = await get_ocr().extract_text(
        file_bytes=data, filename=row["filename"], content_type=row.get("content_type", "")
    )
    repo.create(
        "ocr_results",
        OcrResultEntity(
            document_id=document_id, patient_id=patient_id, engine=ocr.engine,
            raw_text=ocr.text, mean_confidence=ocr.mean_confidence, pages=ocr.pages, payload=ocr.raw,
        ),
    )

    if not ocr.text.strip():
        repo.update("documents", document_id, {
            "status": DocumentStatus.FAILED.value,
            "ocr_text": "", "ocr_engine": ocr.engine, "ocr_confidence": ocr.mean_confidence,
            "error": ocr.error or "OCR produced no text. You can enter the text manually.",
        })
        return DocumentProcessOut(
            document=_to_out(repo.get("documents", document_id)),
            used_ocr_fallback=ocr.used_fallback,
            message=ocr.error or "No text extracted",
        )

    repo.update("documents", document_id, {
        "status": DocumentStatus.OCR_DONE.value,
        "ocr_text": ocr.text, "ocr_engine": ocr.engine, "ocr_confidence": ocr.mean_confidence,
        "error": None,
    })

    structured, used_llm_fallback = await _structure_text(ocr.text, row["filename"])

    dtype = structured.document_type
    if dtype == DocumentType.OTHER and row.get("document_type") not in (None, DocumentType.OTHER.value):
        structured.document_type = DocumentType(row["document_type"])

    repo.update("documents", document_id, {
        "status": DocumentStatus.STRUCTURED.value,
        "document_type": structured.document_type if isinstance(structured.document_type, str) else structured.document_type.value,
        "structured": structured.model_dump(mode="json"),
    })
    _persist_doc_extractions(repo, patient_id, row.get("session_id"), document_id, structured)
    _index_document(patient_id, row.get("session_id"), document_id, row["filename"], ocr.text, structured)

    return DocumentProcessOut(
        document=_to_out(repo.get("documents", document_id)),
        used_ocr_fallback=ocr.used_fallback,
        used_llm_fallback=used_llm_fallback,
        message="Document processed.",
    )


async def apply_correction(
    repo: BaseRepository, *, document_id: UUID, patient_id: UUID, correction: DocumentCorrectionIn
) -> DocumentOut:
    row = repo.get_or_404("documents", document_id, label="document")
    repo.ensure_owned(row, patient_id, table="documents")

    patch: dict = {"corrected_by_user": True, "error": None}
    if correction.ocr_text is not None:
        patch["ocr_text"] = correction.ocr_text
    structured = None
    if correction.structured is not None:
        structured = correction.structured
    elif correction.ocr_text is not None:
        structured, _ = await _structure_text(correction.ocr_text, row["filename"])
    if correction.document_type is not None:
        dt = getattr(correction.document_type, "value", correction.document_type)
        patch["document_type"] = dt
        if structured is not None:
            structured.document_type = dt
    if structured is not None:
        patch["structured"] = structured.model_dump(mode="json")
        patch["status"] = DocumentStatus.STRUCTURED.value
        _persist_doc_extractions(repo, patient_id, row.get("session_id"), document_id, structured)
        _index_document(patient_id, row.get("session_id"), document_id, row["filename"],
                        patch.get("ocr_text") or row.get("ocr_text") or "", structured)

    repo.update("documents", document_id, patch)
    return _to_out(repo.get("documents", document_id))


# --------------------------------------------------------------------------- #
# Structuring
# --------------------------------------------------------------------------- #
async def _structure_text(text: str, filename: str) -> tuple[StructuredDocument, bool]:
    groq = get_groq()
    if groq.available:
        try:
            data = await groq.chat_json(
                DOC_STRUCTURE_SYSTEM,
                doc_structure_user_prompt(ocr_text=text, filename=filename),
                temperature=0.1,
                max_tokens=1800,
            )
            return _coerce_structured(data), False
        except (GroqUnavailable, GroqBadJSON) as exc:
            log.info("Doc structuring LLM fallback (%s)", type(exc).__name__)
    return heuristic_structure(text), True


def _coerce_structured(raw: dict) -> StructuredDocument:
    try:
        return StructuredDocument.model_validate(raw)
    except Exception:
        safe = {k: raw[k] for k in StructuredDocument.model_fields if k in raw}
        try:
            return StructuredDocument.model_validate(safe)
        except Exception:
            return StructuredDocument()


_DATE_RE = re.compile(
    r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}|"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\b",
    re.IGNORECASE,
)
# Applied per-line (never across newlines) to avoid greedy cross-line matches.
_MED_LINE_RE = re.compile(
    r"(?:tab|cap|caps|syp|syrup|inj|tablet|capsule)s?\.?\s+"
    r"([A-Za-z][A-Za-z\-]{2,32})"
    r"(?:\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|iu|units?)))?"
    r"(?:\s+([0-9]\s*-\s*[0-9]\s*-\s*[0-9]|od|bd|tds|qid|hs|once daily|twice daily|"
    r"thrice daily|three times daily|at night|morning|every \d+ ?h(?:ours?)?))?",
    re.IGNORECASE,
)
_LAB_LINE_RE = re.compile(
    r"^\s*([A-Za-z][A-Za-z0-9()/%.\-\s]{1,40}?)\s*[:=]\s*"
    r"([<>]?\s*\d+(?:\.\d+)?)\s*"
    r"([A-Za-z%µ][A-Za-z%µ/0-9^]*)?\s*"
    r"\(?\s*(?:ref(?:erence)?(?:\s*range)?[:.\s]*)?"
    r"(\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?\s*\)?",
    re.IGNORECASE,
)


def heuristic_structure(text: str) -> StructuredDocument:
    """Regex-based best-effort structuring when no LLM is available."""
    low = text.lower()
    doc_type = DocumentType.OTHER
    for dt, hints in _DOC_TYPE_HINTS:
        if any(h in low for h in hints):
            doc_type = dt
            break

    date_match = _DATE_RE.search(text)
    doc_date = date_match.group(0) if date_match else ""

    hospital = ""
    for line in text.splitlines()[:8]:
        if re.search(r"hospital|clinic|medical center|diagnostics|laborator", line, re.IGNORECASE):
            hospital = line.strip()[:120]
            break

    doctor = ""
    m = re.search(r"\bDr\.?\s+([A-Z][A-Za-z.\-]+(?:\s+[A-Z][A-Za-z.\-]+){0,2})", text)
    if m:
        doctor = "Dr. " + m.group(1)

    lines = text.splitlines()

    meds: list[MedicationExtract] = []
    seen_meds: set[str] = set()
    for line in lines:
        mm = _MED_LINE_RE.search(line)
        if not mm:
            continue
        name = re.sub(r"\s+", " ", (mm.group(1) or "").strip(" .,-")).title()
        if len(name) < 3 or name.lower() in seen_meds:
            continue
        seen_meds.add(name.lower())
        meds.append(MedicationExtract(
            name=name,
            dosage=re.sub(r"\s+", " ", (mm.group(2) or "").strip()),
            frequency=_norm_freq(re.sub(r"\s+", "", mm.group(3) or "")),
        ))
        if len(meds) >= 25:
            break

    labs: list[LabResultExtract] = []
    _LAB_SKIP = {"age", "date", "phone", "id", "sex", "no", "mrn", "name", "ref", "reference",
                 "patient", "specimen", "sample", "dob", "uhid", "bill"}
    if doc_type in (DocumentType.LAB_REPORT, DocumentType.DISCHARGE_SUMMARY, DocumentType.OTHER):
        for line in lines:
            lm = _LAB_LINE_RE.match(line)
            if not lm:
                continue
            name = re.sub(r"\s+", " ", lm.group(1).strip(" .:-"))
            if len(name) < 3 or name.lower() in _LAB_SKIP:
                continue
            unit = (lm.group(3) or "").strip()
            if unit.lower() in {"am", "pm", "yrs", "year", "years"}:
                unit = ""
            labs.append(LabResultExtract(
                test_name=name.title(),
                value=re.sub(r"\s+", "", lm.group(2)),
                unit=unit,
                reference_range=re.sub(r"\s+", " ", (lm.group(4) or "").strip()),
            ))
            if len(labs) >= 40:
                break

    diagnoses: list[str] = []
    for key in ("diagnosis", "impression", "provisional diagnosis", "final diagnosis", "assessment"):
        for m in re.finditer(rf"{key}\s*[:\-]\s*(.+)", text, re.IGNORECASE):
            val = m.group(1).strip().split("  ")[0][:160]
            if val and val.lower() not in (d.lower() for d in diagnoses):
                diagnoses.append(val)

    surgeries: list[str] = []
    for m in re.finditer(r"(?:surgery|operation|procedure|s/p|status post)\s*[:\-]?\s*(.+)", text, re.IGNORECASE):
        val = m.group(1).strip()[:140]
        if val:
            surgeries.append(val)

    notes: list[str] = []
    for key in ("advice", "note", "notes", "instructions", "plan"):
        m = re.search(rf"{key}\s*[:\-]\s*(.+)", text, re.IGNORECASE)
        if m:
            notes.append(m.group(1).strip()[:200])

    follow = ""
    m = re.search(r"follow[\s-]?up\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
    if m:
        follow = m.group(1).strip()[:160]

    return StructuredDocument(
        document_type=doc_type,
        document_date=doc_date,
        hospital_or_clinic=hospital,
        doctor_name=doctor,
        diagnoses=diagnoses[:15],
        medications=meds,
        lab_results=labs,
        procedures=[],
        previous_surgeries=surgeries[:10],
        important_notes=notes[:8],
        follow_up=follow,
    )


def _norm_freq(raw: str) -> str:
    raw = raw.lower().strip()
    return {
        "od": "once daily", "1-0-0": "once daily (morning)",
        "bd": "twice daily", "1-0-1": "twice daily", "0-0-1": "once at night",
        "tds": "three times daily", "1-1-1": "three times daily",
        "qid": "four times daily", "hs": "at bedtime",
    }.get(raw, raw)


# --------------------------------------------------------------------------- #
# Persistence + indexing helpers
# --------------------------------------------------------------------------- #
def _persist_doc_extractions(repo, patient_id, session_id, document_id, sd: StructuredDocument) -> None:
    for m in sd.medications:
        if m.name:
            repo.create("medications", MedicationEntity(
                patient_id=patient_id, session_id=session_id, document_id=document_id,
                name=m.name, dosage=m.dosage, frequency=m.frequency, route=m.route,
                duration=m.duration, source="document"))
    for lab in sd.lab_results:
        if lab.test_name:
            repo.create("lab_results", LabResultEntity(
                patient_id=patient_id, session_id=session_id, document_id=document_id,
                test_name=lab.test_name, value=lab.value, unit=lab.unit,
                reference_range=lab.reference_range, flag=lab.flag, observed_at=lab.observed_at))


def _chunk_text(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    if len(text) <= size:
        return [text] if text else []
    chunks, start = [], 0
    while start < len(text):
        end = min(len(text), start + size)
        chunks.append(text[start:end])
        start = end - overlap
    return chunks


def _index_document(patient_id, session_id, document_id, filename, ocr_text, sd: StructuredDocument) -> None:
    try:
        store = get_vector_store()
        records: list[VectorRecord] = []
        summary_line = (
            f"{sd.document_type} dated {sd.document_date or 'unknown'} from "
            f"{sd.hospital_or_clinic or 'unknown facility'}. "
            f"Diagnoses: {', '.join(sd.diagnoses) or 'none'}. "
            f"Medications: {', '.join(m.name for m in sd.medications) or 'none'}. "
            f"Labs: {', '.join(l.test_name for l in sd.lab_results) or 'none'}."
        )
        base_md = {
            "patient_id": str(patient_id),
            "session_id": str(session_id) if session_id else "",
            "document_id": str(document_id),
            "kind": "document",
            "document_type": sd.document_type if isinstance(sd.document_type, str) else sd.document_type.value,
            "source": filename,
        }
        records.append(VectorRecord(id=f"doc::{document_id}::summary", text=summary_line, metadata=dict(base_md)))
        for i, chunk in enumerate(_chunk_text(ocr_text)):
            records.append(VectorRecord(id=f"doc::{document_id}::{i}", text=chunk, metadata=dict(base_md)))
        if records:
            store.upsert(str(patient_id), records)
    except Exception as exc:  # noqa: BLE001 - indexing is best effort
        log.warning("Document indexing skipped (%s)", type(exc).__name__)


def _load_bytes(row: dict) -> bytes | None:
    path = row.get("stored_path")
    if not path:
        return None
    try:
        from pathlib import Path

        return Path(path).read_bytes()
    except OSError:
        return None


def _to_out(row: dict | None) -> DocumentOut:
    if not row:
        raise NotFoundError("document not found")
    structured = row.get("structured")
    return DocumentOut(
        id=row["id"],
        session_id=row["session_id"],
        patient_id=row["patient_id"],
        filename=row["filename"],
        content_type=row.get("content_type", "application/octet-stream"),
        size_bytes=row.get("size_bytes", 0),
        document_type=row.get("document_type", DocumentType.OTHER.value),
        status=row.get("status", DocumentStatus.UPLOADED.value),
        ocr_text=row.get("ocr_text"),
        ocr_engine=row.get("ocr_engine"),
        ocr_confidence=row.get("ocr_confidence"),
        structured=StructuredDocument.model_validate(structured) if structured else None,
        error=row.get("error"),
        corrected_by_user=row.get("corrected_by_user", False),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def document_to_out(row: dict) -> DocumentOut:
    return _to_out(row)
