"""Seed the MINIMAL demo dataset so you can verify MACI end-to-end.

    python scripts/seed_demo_data.py            # ingest + index the demo records
    python scripts/seed_demo_data.py --no-index # skip vector indexing
    python scripts/seed_demo_data.py --list     # just show what would be ingested

This is intentionally tiny. Provide the real dataset later with
``scripts/import_dataset.py`` - no application code needs to change.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from _maci_ingest import (  # noqa: E402  (path set inside the module)
    ROOT,
    get_repository,
    ingest_record,
    load_records,
    log,
    summarise_target,
)

DEMO_DIR = ROOT / "data" / "demo"
DEMO_FILES = ["demo_intake_records.jsonl", "demo_patients.csv"]


def main() -> None:
    ap = argparse.ArgumentParser(description="Seed the MACI demo dataset")
    ap.add_argument("--no-index", action="store_true", help="do not push vectors to the vector store")
    ap.add_argument("--list", action="store_true", help="print records and exit without writing")
    args = ap.parse_args()

    records: list[dict] = []
    for name in DEMO_FILES:
        path = DEMO_DIR / name
        if not path.exists():
            log.warning("demo file missing: %s", path)
            continue
        recs = load_records(path)
        log.info("Loaded %d record(s) from %s", len(recs), name)
        records.extend(recs)

    if not records:
        raise SystemExit("No demo records found under data/demo/")

    if args.list:
        print(json.dumps(records, indent=2)[:8000])
        return

    repo = get_repository()
    log.info("Target: %s", summarise_target(repo))
    if repo.backend == "memory":
        log.warning(
            "Repository is in-memory: seeded data will NOT persist across processes. "
            "Set SUPABASE_URL / SUPABASE_KEY to persist."
        )

    results = []
    for rec in records:
        res = ingest_record(repo, rec, do_index=not args.no_index)
        results.append(res)
        log.info(
            "seeded patient=%s session=%s docs=%d vectors=%d red_flag=%s",
            res["patient_id"], res["session_id"], len(res["documents"]),
            res["vectors_indexed"], res["red_flag"],
        )

    print("\n=== Demo seed complete ===")
    print(json.dumps(results, indent=2))
    print("\nOpen the doctor dashboard queue:  GET /api/doctor/queue")


if __name__ == "__main__":
    main()
