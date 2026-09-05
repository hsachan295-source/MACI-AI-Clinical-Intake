"""Central configuration for the MACI backend.

Every secret is read here (server-side only) and never returned to the client.
The application is designed to *run without any integration keys*: each service
falls back to a deterministic offline/demo implementation when its key is
missing, so local development and the automated test-suite never touch a paid
API or consume quota.
"""
from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo layout:  <root>/backend/app/core/config.py  ->  <root>
BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BACKEND_DIR.parent

# Load `.env` from the backend folder first, then the repo root (root wins only
# for keys not already set). pydantic-settings reads the *last* existing file.
_ENV_FILES = [ROOT_DIR / ".env", BACKEND_DIR / ".env"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(p) for p in _ENV_FILES if p.exists()] or None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_env: str = "development"
    app_debug: bool = True
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "*"

    # --- Groq ---
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # --- OCR.Space ---
    ocr_space_api_key: str | None = None
    ocr_space_api_url: str = "https://api.ocr.space/parse/image"
    ocr_space_language: str = "eng"

    # --- Pinecone ---
    pinecone_api_key: str | None = None
    pinecone_host: str | None = None
    pinecone_index_name: str = "maci-medical-records"
    pinecone_dimension: int = 384
    pinecone_metric: str = "cosine"

    # --- Supabase ---
    # Accept both the legacy names (SUPABASE_KEY / SUPABASE_SERVICE_KEY) and the
    # newer Supabase names (SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY /
    # SUPABASE_ANON_KEY) so the Vercel env vars work as-is.
    supabase_url: str | None = None
    supabase_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "supabase_key", "SUPABASE_KEY",
            "supabase_publishable_key", "SUPABASE_PUBLISHABLE_KEY",
            "supabase_anon_key", "SUPABASE_ANON_KEY",
        ),
    )
    supabase_service_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "supabase_service_key", "SUPABASE_SERVICE_KEY",
            "supabase_secret_key", "SUPABASE_SECRET_KEY",
            "supabase_service_role_key", "SUPABASE_SERVICE_ROLE_KEY",
        ),
    )

    # --- Embeddings ---
    embedding_provider: str = "auto"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimension: int = 384

    # --- Storage ---
    upload_dir: str = "data/uploads"
    max_upload_mb: int = 15

    # --- Safety / behaviour ---
    max_interview_questions: int = 12
    llm_max_retries: int = 2

    # ------------------------------------------------------------------ helpers
    @field_validator("cors_origins")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_serverless(self) -> bool:
        """True on Vercel / AWS Lambda where only /tmp is writable."""
        return bool(
            os.environ.get("VERCEL")
            or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
            or os.environ.get("LAMBDA_TASK_ROOT")
        )

    @property
    def upload_path(self) -> Path:
        """Writable directory for temporary uploaded files.

        On serverless only ``/tmp`` is writable; everywhere else use the
        configured ``upload_dir``. Never raises - falls back to the system temp
        dir if the preferred location cannot be created.
        """
        if self.is_serverless:
            p = Path(tempfile.gettempdir()) / "maci" / Path(self.upload_dir).name
        else:
            p = Path(self.upload_dir)
            if not p.is_absolute():
                p = ROOT_DIR / p
        try:
            p.mkdir(parents=True, exist_ok=True)
        except OSError:
            p = Path(tempfile.gettempdir()) / "maci-uploads"
            p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    # --- integration availability flags ------------------------------------
    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def ocr_enabled(self) -> bool:
        return bool(self.ocr_space_api_key)

    @property
    def pinecone_enabled(self) -> bool:
        return bool(self.pinecone_api_key and (self.pinecone_host or self.pinecone_index_name))

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    def integration_status(self) -> dict[str, bool]:
        return {
            "groq": self.groq_enabled,
            "ocr_space": self.ocr_enabled,
            "pinecone": self.pinecone_enabled,
            "supabase": self.supabase_enabled,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
