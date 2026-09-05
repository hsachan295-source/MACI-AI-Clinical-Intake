"""OCR via OCR.Space, with an offline fallback.

* With ``OCR_SPACE_API_KEY`` set: real OCR of images / PDFs.
* Without a key: plain-text / markdown / JSON uploads are read directly; other
  binary formats return an explanatory empty result so the pipeline continues
  and the doctor/patient can type the text in manually.
"""
from __future__ import annotations

import io
import json
from dataclasses import dataclass, field

import httpx

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("services.ocr")

TEXT_LIKE = {
    "text/plain", "text/markdown", "application/json", "text/csv", "application/xml", "text/xml",
}
TEXT_LIKE_EXT = (".txt", ".md", ".markdown", ".json", ".csv", ".log", ".text")


@dataclass
class OcrOutcome:
    text: str
    engine: str
    mean_confidence: float | None = None
    pages: int = 1
    used_fallback: bool = False
    error: str | None = None
    raw: dict = field(default_factory=dict)


class OcrService:
    def __init__(self) -> None:
        self.api_key = settings.ocr_space_api_key
        self.url = settings.ocr_space_api_url
        self.language = settings.ocr_space_language

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def extract_text(
        self, *, file_bytes: bytes, filename: str, content_type: str
    ) -> OcrOutcome:
        name = (filename or "").lower()
        ctype = (content_type or "").lower()

        # 1) direct read for text-like uploads (works with or without a key)
        if ctype in TEXT_LIKE or name.endswith(TEXT_LIKE_EXT):
            try:
                text = file_bytes.decode("utf-8", errors="replace").strip()
                return OcrOutcome(text=text, engine="direct-text", mean_confidence=1.0)
            except Exception as exc:  # pragma: no cover - defensive
                return OcrOutcome(text="", engine="direct-text", error=str(type(exc).__name__))

        # 2) real OCR
        if self.available:
            try:
                return await self._ocr_space(file_bytes, name or "upload", ctype)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                log.warning("OCR.Space unreachable: %s", type(exc).__name__)
                return OcrOutcome(
                    text="", engine="ocr.space", used_fallback=True,
                    error=f"OCR service unreachable ({type(exc).__name__})",
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("OCR.Space failed: %s", type(exc).__name__)
                return OcrOutcome(
                    text="", engine="ocr.space", used_fallback=True,
                    error=f"OCR failed ({type(exc).__name__})",
                )

        # 3) no key, binary file
        return OcrOutcome(
            text="",
            engine="none",
            used_fallback=True,
            error=(
                "OCR is not configured for this deployment. Upload a text file, "
                "or enter the document text manually."
            ),
        )

    async def _ocr_space(self, file_bytes: bytes, filename: str, content_type: str) -> OcrOutcome:
        ext = filename.rsplit(".", 1)[-1].upper() if "." in filename else "PNG"
        if ext not in {"PDF", "PNG", "JPG", "JPEG", "GIF", "TIF", "TIFF", "BMP"}:
            ext = "PNG"
        data = {
            "apikey": self.api_key,
            "language": self.language,
            "isOverlayRequired": "true",
            "OCREngine": "2",
            "scale": "true",
            "detectOrientation": "true",
            "filetype": "JPG" if ext == "JPEG" else ext,
        }
        files = {"file": (filename, io.BytesIO(file_bytes), content_type or "application/octet-stream")}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(self.url, data=data, files=files)
        resp.raise_for_status()
        payload = resp.json()

        if payload.get("IsErroredOnProcessing"):
            msg = payload.get("ErrorMessage") or payload.get("ErrorDetails") or "OCR processing error"
            if isinstance(msg, list):
                msg = "; ".join(str(m) for m in msg)
            return OcrOutcome(text="", engine="ocr.space", error=str(msg), raw=_slim(payload))

        results = payload.get("ParsedResults") or []
        text = "\n\n".join((r.get("ParsedText") or "").strip() for r in results).strip()
        confidence = _mean_word_confidence(results)
        return OcrOutcome(
            text=text,
            engine="ocr.space",
            mean_confidence=confidence,
            pages=max(1, len(results)),
            raw=_slim(payload),
            error=None if text else "OCR returned no text",
        )


def _mean_word_confidence(results: list[dict]) -> float | None:
    vals: list[float] = []
    for r in results:
        overlay = r.get("TextOverlay") or {}
        for line in overlay.get("Lines") or []:
            for word in line.get("Words") or []:
                c = word.get("WordConfidence")
                if isinstance(c, (int, float)):
                    vals.append(float(c) / 100.0 if c > 1 else float(c))
    if not vals:
        return None
    return round(sum(vals) / len(vals), 3)


def _slim(payload: dict) -> dict:
    """Drop bulky overlay data before persisting the raw response."""
    slim = {k: v for k, v in payload.items() if k != "ParsedResults"}
    slim["ParsedResults"] = [
        {k: v for k, v in (r or {}).items() if k != "TextOverlay"}
        for r in (payload.get("ParsedResults") or [])
    ]
    return json.loads(json.dumps(slim, default=str))


_ocr: OcrService | None = None


def get_ocr() -> OcrService:
    global _ocr
    if _ocr is None:
        _ocr = OcrService()
    return _ocr
