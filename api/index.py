"""Vercel serverless entrypoint when the project Root Directory is the REPO ROOT.

(The canonical backend deployment uses Root Directory = ``backend`` and
``backend/api/index.py``. This file makes a repo-root deployment work too.)
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _REPO_ROOT / "backend"
for _p in (str(_BACKEND_DIR), str(_REPO_ROOT)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from app.main import app  # noqa: F401
except BaseException as exc:  # noqa: BLE001
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
