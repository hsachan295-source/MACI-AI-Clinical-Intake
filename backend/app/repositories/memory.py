"""In-memory repository - default when Supabase is not configured.

Data lives for the lifetime of the process only. Adequate for local dev,
demos and the automated test-suite.
"""
from __future__ import annotations

import copy
import threading
from typing import Any

from app.repositories.base import BaseRepository, Collection, TABLES


class _MemoryCollection(Collection):
    def __init__(self, lock: threading.RLock) -> None:
        self._rows: dict[str, dict[str, Any]] = {}
        self._lock = lock

    def insert(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            row_id = str(row.get("id"))
            self._rows[row_id] = copy.deepcopy(row)
            return copy.deepcopy(self._rows[row_id])

    def get(self, row_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._rows.get(str(row_id))
            return copy.deepcopy(row) if row else None

    def update(self, row_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            row_id = str(row_id)
            if row_id not in self._rows:
                raise KeyError(row_id)
            self._rows[row_id].update(copy.deepcopy(patch))
            return copy.deepcopy(self._rows[row_id])

    def list(self, *, order_by: str = "created_at", desc: bool = False) -> list[dict[str, Any]]:
        with self._lock:
            rows = [copy.deepcopy(r) for r in self._rows.values()]
        rows.sort(key=lambda r: r.get(order_by) or "", reverse=desc)
        return rows

    def query(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        with self._lock:
            rows = [copy.deepcopy(r) for r in self._rows.values()]
        out = []
        for r in rows:
            if all(str(r.get(k)) == str(v) for k, v in filters.items()):
                out.append(r)
        out.sort(key=lambda r: r.get("created_at") or "")
        return out

    def delete(self, row_id: str) -> None:
        with self._lock:
            self._rows.pop(str(row_id), None)


class InMemoryRepository(BaseRepository):
    backend = "memory"

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._collections: dict[str, _MemoryCollection] = {
            name: _MemoryCollection(self._lock) for name in TABLES
        }

    def _collection(self, name: str) -> Collection:
        if name not in self._collections:
            self._collections[name] = _MemoryCollection(self._lock)
        return self._collections[name]

    def clear(self) -> None:
        for name in list(self._collections):
            self._collections[name] = _MemoryCollection(self._lock)
