"""Typed application errors + FastAPI exception handlers.

All handlers return a small, safe JSON envelope and never leak internal
details / stack traces / secrets to the client.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

log = get_logger("errors")


class MaciError(Exception):
    """Base class for expected, handled application errors."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "maci_error"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(MaciError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ValidationError(MaciError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_error"


class ConsentRequiredError(MaciError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "consent_required"


class PatientIsolationError(MaciError):
    """Raised when a request would cross patient boundaries."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "patient_isolation_violation"


class UpstreamUnavailableError(MaciError):
    """A third-party dependency (Groq/OCR/Pinecone/Supabase) is unavailable."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "upstream_unavailable"


class FileValidationError(MaciError):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    code = "invalid_file"


def _envelope(code: str, message: str, details: dict | None = None) -> dict:
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(MaciError)
    async def _maci_error(_: Request, exc: MaciError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        # Trim noisy validation payloads; keep field locations only.
        fields = [
            {"loc": ".".join(str(p) for p in e.get("loc", [])), "msg": e.get("msg")}
            for e in exc.errors()[:20]
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("validation_error", "Request validation failed", {"fields": fields}),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope("http_error", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):  # pragma: no cover
        # Log with type only - never echo the raw exception to the client.
        log.exception("Unhandled error on %s %s: %s", request.method, request.url.path, type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("internal_error", "An unexpected error occurred. Please try again."),
        )
