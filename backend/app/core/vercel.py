"""Serverless (Vercel) compatibility helpers.

Vercel ``rewrites`` send the *destination* path to the function and drop the
caller's original path (it is not in the ASGI scope nor in any header). For a
catch-all FastAPI app that breaks every route.

Work-around: the rewrite carries the original path in a ``__vpath`` query
parameter (``destination: "/api?__vpath=$1"``); this middleware restores it onto
the ASGI scope and removes the marker, so FastAPI routes exactly as it does
locally. It is a no-op when ``__vpath`` is absent, so it is safe to leave
always-installed on serverless.
"""
from __future__ import annotations

from urllib.parse import parse_qsl, urlencode

_MARKER = b"__vpath="


class VercelRewritePathMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            raw_qs: bytes = scope.get("query_string", b"") or b""
            if _MARKER in raw_qs:
                vpath = ""
                keep: list[tuple[str, str]] = []
                for key, value in parse_qsl(raw_qs.decode("latin-1"), keep_blank_values=True):
                    if key == "__vpath" and not vpath:
                        vpath = value
                    else:
                        keep.append((key, value))
                new_path = "/" + vpath.lstrip("/")
                scope = dict(scope)
                scope["path"] = new_path
                scope["raw_path"] = new_path.encode("latin-1")
                scope["query_string"] = urlencode(keep).encode("latin-1")
        await self.app(scope, receive, send)
