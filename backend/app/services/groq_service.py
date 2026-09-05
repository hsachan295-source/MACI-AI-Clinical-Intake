"""Groq LLM client (OpenAI-compatible Chat Completions).

Design goals
------------
* **Never crash the request.** If ``GROQ_API_KEY`` is missing or Groq is
  unreachable, raise :class:`GroqUnavailable`; every caller has a deterministic
  fallback.
* **Always return valid JSON** from :meth:`chat_json` - three-stage recovery:
  direct parse -> balanced-brace extraction -> a dedicated "repair" LLM call.
* **No quota use in tests.** Tests monkeypatch :meth:`_chat_completion`.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import UpstreamUnavailableError
from app.core.logging import get_logger
from app.services.prompts import REPAIR_SYSTEM

log = get_logger("services.groq")


class GroqUnavailable(UpstreamUnavailableError):
    code = "groq_unavailable"


class GroqBadJSON(UpstreamUnavailableError):
    code = "groq_bad_json"


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """Pull the first balanced ``{...}`` block out of arbitrary text."""
    if not text:
        return None
    text = text.strip()
    # Strip markdown fences if present.
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start : i + 1]
                try:
                    obj = json.loads(candidate)
                    return obj if isinstance(obj, dict) else None
                except json.JSONDecodeError:
                    return None
    return None


class GroqService:
    def __init__(self) -> None:
        self.model = settings.groq_model
        self.base_url = settings.groq_base_url.rstrip("/")
        self.api_key = settings.groq_api_key
        self.max_retries = max(0, settings.llm_max_retries)

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    # ------------------------------------------------------------------ HTTP
    async def _chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        json_mode: bool,
        temperature: float,
        max_tokens: int,
    ) -> str:
        if not self.api_key:
            raise GroqUnavailable("Groq API key is not configured")

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions", headers=headers, json=payload
                )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise GroqUnavailable(f"Groq request failed: {type(exc).__name__}") from exc

        if resp.status_code == 429:
            raise GroqUnavailable("Groq rate limit reached")
        if resp.status_code >= 500:
            raise GroqUnavailable(f"Groq server error ({resp.status_code})")
        if resp.status_code >= 400:
            # 4xx other than 429 is a bug on our side - surface minimally.
            log.warning("Groq 4xx: %s", resp.status_code)
            raise GroqUnavailable(f"Groq rejected the request ({resp.status_code})")

        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise GroqUnavailable("Groq returned an unexpected response shape") from exc

    # ------------------------------------------------------------------ public
    async def chat_text(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.3,
        max_tokens: int = 900,
    ) -> str:
        return await self._chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            json_mode=False,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def chat_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.2,
        max_tokens: int = 1600,
    ) -> dict[str, Any]:
        """Return a dict. Retries + a repair pass guarantee valid JSON or raises."""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        last_raw = ""
        for attempt in range(self.max_retries + 1):
            raw = await self._chat_completion(
                messages, json_mode=True, temperature=temperature, max_tokens=max_tokens
            )
            last_raw = raw
            obj = _extract_json_object(raw)
            if obj is not None:
                return obj
            log.warning("Groq JSON parse failed (attempt %d/%d)", attempt + 1, self.max_retries + 1)
            messages.append({"role": "assistant", "content": raw[:2000]})
            messages.append(
                {
                    "role": "user",
                    "content": "That was not valid JSON. Reply again with ONLY a single valid JSON object.",
                }
            )

        # Dedicated repair call.
        try:
            repaired = await self._chat_completion(
                [
                    {"role": "system", "content": REPAIR_SYSTEM},
                    {"role": "user", "content": last_raw[:6000]},
                ],
                json_mode=True,
                temperature=0.0,
                max_tokens=max_tokens,
            )
            obj = _extract_json_object(repaired)
            if obj is not None:
                log.info("Groq JSON recovered via repair pass")
                return obj
        except GroqUnavailable:
            pass
        raise GroqBadJSON("Groq did not return parseable JSON after retries and repair")


_groq: GroqService | None = None


def get_groq() -> GroqService:
    global _groq
    if _groq is None:
        _groq = GroqService()
    return _groq
