"""Voice normalisation + a modular TTS seam.

Today: light transcript clean-up; TTS is handled in-browser. Swap
:func:`synthesize` for a real provider (e.g. a multilingual ASR/TTS API) later
without touching callers.
"""
from __future__ import annotations

import re

_FILLERS = re.compile(r"\b(uh+|um+|erm+|hmm+|you know|like,)\b", re.IGNORECASE)
_SPACES = re.compile(r"\s+")


def normalize_transcript(text: str) -> str:
    text = _FILLERS.sub("", text or "")
    text = _SPACES.sub(" ", text).strip(" ,.;")
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    return text


def word_count(text: str) -> int:
    return len([w for w in re.split(r"\s+", text.strip()) if w])


async def synthesize(text: str, language: str, voice_hint: str | None = None) -> dict:
    """Return TTS instructions. The MVP returns parameters for the browser's
    ``speechSynthesis``; a future provider would return ``audio_base64``.
    """
    rate = 0.95 if language == "hi" else 1.0
    return {
        "text": text,
        "language": language,
        "provider": "browser-speech-synthesis",
        "audio_base64": None,
        "rate": rate,
        "pitch": 1.0,
    }
