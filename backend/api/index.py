"""Vercel serverless entrypoint for the MACI FastAPI backend.

Vercel (Root Directory = ``backend``) uploads this repo's ``backend/`` folder to
the function root and imports this module, expecting an ASGI ``app``.

If importing the real app ever fails, we still export a minimal ASGI app that
returns the traceback as JSON on every route - so the failure is *visible* via
an HTTP request instead of an opaque ``FUNCTION_INVOCATION_FAILED``.
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

# Make the sibling ``app`` package importable regardless of Vercel's cwd/path.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

try:
    from app.main import app  # noqa: F401  (re-exported for Vercel)
except BaseException as exc:  # noqa: BLE001 - we must still expose *something*
    _TB = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    print("MACI startup import FAILED:\n" + _TB, file=sys.stderr)

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="MACI API (degraded - import error)")

    @app.get("/health")
    @app.get("/api/health")
    def _health() -> dict:
        return {"status": "degraded", "service": "MACI API", "error": "startup import failed"}

    @app.api_route("/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
    def _catch_all(path: str) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "startup_import_error",
                    "message": "The MACI backend failed to import on this deployment.",
                    "exception": _TB.splitlines()[-1] if _TB else "unknown",
                    "traceback": _TB.splitlines()[-25:],
                }
            },
        )


__all__ = ["app"]
