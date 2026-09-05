"""Data-access layer.

``get_repository()`` returns a Supabase-backed repository when
``SUPABASE_URL`` / ``SUPABASE_KEY`` are configured *and* the client library is
importable and reachable; otherwise it returns an in-memory repository so the
app (and the test-suite) always runs.
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger
from app.repositories.base import BaseRepository
from app.repositories.memory import InMemoryRepository

log = get_logger("repositories")


@lru_cache
def get_repository() -> BaseRepository:
    if settings.supabase_enabled:
        try:
            from app.repositories.supabase_repo import SupabaseRepository

            repo = SupabaseRepository()
            repo.ping()
            log.info("Using Supabase repository")
            return repo
        except Exception as exc:  # pragma: no cover - network/import dependent
            log.warning("Supabase unavailable (%s) - falling back to in-memory store", type(exc).__name__)
    else:
        log.info("Supabase not configured - using in-memory repository (data is not persisted)")
    return InMemoryRepository()


def reset_repository_cache() -> None:
    get_repository.cache_clear()
