"""Top-level ASGI entrypoint.

Some Vercel setups (the "FastAPI" framework preset) auto-detect the app in a
root-level ``main.py``; others use ``api/index.py``. Both point at the same
application object defined in ``app/main.py``.

Local:   uvicorn main:app --reload   (from backend/)   -- also works with app.main:app
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

try:
    from app.main import app  # noqa: F401  (re-exported)
except BaseException as exc:  # noqa: BLE001 - keep the failure visible over HTTP
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
