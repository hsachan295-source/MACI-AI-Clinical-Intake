"""Supabase-backed repository.

Uses the official ``supabase`` Python client. All access is server-side with the
configured key. If any call fails at construction time the factory in
``repositories/__init__.py`` falls back to the in-memory store.
"""
from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.repositories.base import BaseRepository, Collection

log = get_logger("repositories.supabase")


class _SupabaseCollection(Collection):
    def __init__(self, client: Any, table: str) -> None:
        self._client = client
        self._table = table

    def _t(self):
        return self._client.table(self._table)

    def insert(self, row: dict[str, Any]) -> dict[str, Any]:
        res = self._t().insert(row).execute()
        data = res.data or [row]
        return data[0]

    def get(self, row_id: str) -> dict[str, Any] | None:
        res = self._t().select("*").eq("id", row_id).limit(1).execute()
        return (res.data or [None])[0]

    def update(self, row_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        res = self._t().update(patch).eq("id", row_id).execute()
        data = res.data or []
        if not data:
            # Return a merged view if the client did not echo the row back.
            current = self.get(row_id) or {}
            current.update(patch)
            return current
        return data[0]

    def list(self, *, order_by: str = "created_at", desc: bool = False) -> list[dict[str, Any]]:
        res = self._t().select("*").order(order_by, desc=desc).execute()
        return res.data or []

    def query(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        q = self._t().select("*")
        for k, v in filters.items():
            q = q.eq(k, v)
        res = q.order("created_at", desc=False).execute()
        return res.data or []

    def delete(self, row_id: str) -> None:
        self._t().delete().eq("id", row_id).execute()


class SupabaseRepository(BaseRepository):
    backend = "supabase"

    def __init__(self) -> None:
        from supabase import create_client  # imported lazily

        key = settings.supabase_service_key or settings.supabase_key
        self._client = create_client(settings.supabase_url, key)
        self._cache: dict[str, _SupabaseCollection] = {}

    def _collection(self, name: str) -> Collection:
        if name not in self._cache:
            self._cache[name] = _SupabaseCollection(self._client, name)
        return self._cache[name]

    def ping(self) -> bool:
        # Cheapest possible round-trip: select 0 rows from `patients`.
        self._client.table("patients").select("id").limit(1).execute()
        return True
