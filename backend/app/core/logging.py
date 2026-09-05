"""Logging setup.

A `RedactionFilter` scrubs anything that looks like a secret and common PII
patterns from log records so patient data and API keys never land in logs.
"""
from __future__ import annotations

import logging
import re
import sys

_SECRET_PATTERNS = [
    re.compile(r"(gsk_[A-Za-z0-9]{10,})"),
    re.compile(r"(pcsk_[A-Za-z0-9_\-]{10,})"),
    re.compile(r"(sb_[A-Za-z0-9_\-]{10,})"),
    re.compile(r"(eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})"),
    re.compile(r"(?i)(api[_-]?key\"?\s*[:=]\s*\"?)([^\s\"',}]+)"),
    re.compile(r"(?i)(authorization\"?\s*[:=]\s*\"?)(bearer\s+)?([^\s\"',}]+)"),
]

# Very light PII scrubbing for defence-in-depth (never a substitute for not
# logging patient data in the first place).
_PII_PATTERNS = [
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "<email>"),
    (re.compile(r"\b(?:\+?\d[\d\s-]{7,}\d)\b"), "<phone>"),
]


class RedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        try:
            msg = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        redacted = msg
        for pat in _SECRET_PATTERNS:
            redacted = pat.sub(lambda m: m.group(0).replace(m.groups()[-1], "***"), redacted)
        for pat, repl in _PII_PATTERNS:
            redacted = pat.sub(repl, redacted)
        if redacted != msg:
            record.msg = redacted
            record.args = ()
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
    )
    handler.addFilter(RedactionFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Quieten noisy third parties
    for noisy in ("httpx", "httpcore", "urllib3", "hpack"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"maci.{name}")
