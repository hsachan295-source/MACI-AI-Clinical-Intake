"""Repository interface + shared helpers.

The concrete stores (``InMemoryRepository``, ``SupabaseRepository``) implement
``_collection(name)`` returning an object with the small CRUD surface below.
Everything else (typed accessors, patient-isolation checks) lives here.
"""
from __future__ import annotations

import abc
from datetime import datetime
from typing import Any, Iterable
from uuid import UUID, uuid4

from app.core.errors import NotFoundError, PatientIsolationError
from app.schemas.common import utcnow

# Logical table names - must match supabase/migrations/0001_init.sql
TABLES = (
    "patients",
    "consents",
    "clinical_sessions",
    "clinical_answers",
    "medical_histories",
    "documents",
    "ocr_results",
    "medications",
    "allergies",
    "lab_results",
    "clinical_summaries",
    "alerts",
    "ayush_assessments",
)


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


class Collection(abc.ABC):
    """Minimal CRUD surface for a single table."""

    @abc.abstractmethod
    def insert(self, row: dict[str, Any]) -> dict[str, Any]: ...

    @abc.abstractmethod
    def get(self, row_id: str) -> dict[str, Any] | None: ...

    @abc.abstractmethod
    def update(self, row_id: str, patch: dict[str, Any]) -> dict[str, Any]: ...

    @abc.abstractmethod
    def list(self, *, order_by: str = "created_at", desc: bool = False) -> list[dict[str, Any]]: ...

    @abc.abstractmethod
    def query(self, filters: dict[str, Any]) -> list[dict[str, Any]]: ...

    @abc.abstractmethod
    def delete(self, row_id: str) -> None: ...


class BaseRepository(abc.ABC):
    backend: str = "base"

    @abc.abstractmethod
    def _collection(self, name: str) -> Collection: ...

    def ping(self) -> bool:  # pragma: no cover - overridden where meaningful
        return True

    # ------------------------------------------------------------------ core
    def create(self, table: str, model_or_dict: Any) -> dict[str, Any]:
        row = model_or_dict
        if hasattr(row, "model_dump"):
            row = row.model_dump(mode="json")
        row = _jsonable(dict(row))
        if not row.get("id"):
            row["id"] = str(uuid4())
        row.setdefault("created_at", utcnow().isoformat())
        row["updated_at"] = utcnow().isoformat()
        return self._collection(table).insert(row)

    def get(self, table: str, row_id: str | UUID) -> dict[str, Any] | None:
        return self._collection(table).get(str(row_id))

    def get_or_404(self, table: str, row_id: str | UUID, *, label: str | None = None) -> dict[str, Any]:
        row = self.get(table, row_id)
        if row is None:
            raise NotFoundError(f"{label or table[:-1]} not found", details={"id": str(row_id)})
        return row

    def update(self, table: str, row_id: str | UUID, patch: dict[str, Any]) -> dict[str, Any]:
        patch = _jsonable(dict(patch))
        patch["updated_at"] = utcnow().isoformat()
        return self._collection(table).update(str(row_id), patch)

    def list(self, table: str, *, order_by: str = "created_at", desc: bool = False) -> list[dict[str, Any]]:
        return self._collection(table).list(order_by=order_by, desc=desc)

    def query(self, table: str, **filters: Any) -> list[dict[str, Any]]:
        return self._collection(table).query(_jsonable(filters))

    def delete(self, table: str, row_id: str | UUID) -> None:
        self._collection(table).delete(str(row_id))

    # -------------------------------------------------------- patient isolation
    def ensure_owned(self, row: dict[str, Any], patient_id: str | UUID, *, table: str = "") -> dict[str, Any]:
        """Guarantee ``row`` belongs to ``patient_id`` - raises otherwise."""
        pid = str(patient_id)
        owner = str(row.get("patient_id", ""))
        if owner and owner != pid:
            raise PatientIsolationError(
                "Requested resource does not belong to this patient",
                details={"table": table},
            )
        return row

    def query_for_patient(self, table: str, patient_id: str | UUID, **extra: Any) -> list[dict[str, Any]]:
        """Every multi-row read for patient-scoped tables goes through here."""
        rows = self.query(table, patient_id=str(patient_id), **extra)
        return rows

    # ------------------------------------------------------- convenience reads
    def session_with_patient(self, session_id: str | UUID) -> tuple[dict[str, Any], dict[str, Any]]:
        session = self.get_or_404("clinical_sessions", session_id, label="session")
        patient = self.get_or_404("patients", session["patient_id"], label="patient")
        return session, patient

    def documents_for_session(self, session_id: str | UUID, patient_id: str | UUID) -> list[dict[str, Any]]:
        rows = self.query("documents", session_id=str(session_id), patient_id=str(patient_id))
        return sorted(rows, key=lambda r: r.get("created_at", ""))

    def summary_for_session(self, session_id: str | UUID) -> dict[str, Any] | None:
        rows = self.query("clinical_summaries", session_id=str(session_id))
        if not rows:
            return None
        return sorted(rows, key=lambda r: r.get("created_at", ""))[-1]

    def alerts_for_session(self, session_id: str | UUID) -> list[dict[str, Any]]:
        return self.query("alerts", session_id=str(session_id))

    def bulk_get(self, table: str, ids: Iterable[str]) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for i in ids:
            row = self.get(table, i)
            if row:
                out[str(i)] = row
        return out
