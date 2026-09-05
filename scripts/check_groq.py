"""List the Groq models your key can use and test a JSON completion.

    python scripts/check_groq.py
    python scripts/check_groq.py --model openai/gpt-oss-120b

Uses GROQ_API_KEY from the repo-root .env (or the environment). Makes exactly
one models-list call and (optionally) one tiny chat call - negligible quota.
"""
from __future__ import annotations

import argparse
import json
import sys

from _maci_ingest import ROOT  # sets sys.path + loads nothing heavy

sys.path.insert(0, str(ROOT / "backend"))
import httpx  # noqa: E402

from app.core.config import settings  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=settings.groq_model)
    ap.add_argument("--no-completion", action="store_true")
    args = ap.parse_args()

    if not settings.groq_api_key:
        raise SystemExit("GROQ_API_KEY is not set (checked repo-root .env and environment).")

    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    base = settings.groq_base_url.rstrip("/")

    r = httpx.get(f"{base}/models", headers=headers, timeout=30)
    print(f"GET /models -> {r.status_code}")
    if r.status_code != 200:
        print(r.text[:500])
        sys.exit(1)
    ids = sorted(m["id"] for m in r.json().get("data", []))
    print("\nAvailable models:")
    for i in ids:
        print("  -", i)

    if args.no_completion:
        return

    print(f"\nTesting chat + JSON mode with: {args.model}")
    cr = httpx.post(
        f"{base}/chat/completions",
        headers=headers,
        json={
            "model": args.model,
            "response_format": {"type": "json_object"},
            "temperature": 0,
            "max_tokens": 60,
            "messages": [
                {"role": "system", "content": "Return only a JSON object."},
                {"role": "user", "content": 'Reply with {"status":"ok"}'},
            ],
        },
        timeout=45,
    )
    print(f"POST /chat/completions -> {cr.status_code}")
    if cr.status_code == 200:
        print("  content:", cr.json()["choices"][0]["message"]["content"][:200])
        print("\nOK - set GROQ_MODEL to this value in your .env")
    else:
        print("  ", cr.text[:400])
        print("\nPick a model id from the list above and set GROQ_MODEL accordingly.")
        sys.exit(1)


if __name__ == "__main__":
    main()
