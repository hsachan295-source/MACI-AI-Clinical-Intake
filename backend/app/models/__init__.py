"""Persisted-entity models used by the repository layer.

These mirror the Supabase/PostgreSQL tables defined in
``supabase/migrations/0001_init.sql``. Repositories persist/return plain
JSON-serialisable dicts; these models are used for validation and default
generation on the write path.
"""
