"""Import a REAL MACI dataset (CSV / JSON / JSONL) - no app changes required.

Examples
--------
    python scripts/import_dataset.py --path data/real/intake_2026.jsonl
    python scripts/import_dataset.py --path data/real/*.csv --format csv
    python scripts/import_dataset.py --path data/real/records.json --no-index --limit 50
    python scripts/import_dataset.py --path data/real/records.jsonl --dry-run

Record format: the "unified intake record" documented in data/README_DATA.md.
"""
from __future__ import annotations

import argparse
import glob
import json
import sys

from _maci_ingest import (
    get_repository,
    ingest_record,
    load_records,
    log,
    normalize_record,
    summarise_target,
)


def main() -> None:
    ap = argparse.ArgumentParser(description="Import a MACI dataset")
    ap.add_argument("--path", required=True, help="file or glob (CSV / JSON / JSONL)")
    ap.add_argument("--format", default="auto", choices=["auto", "csv", "json", "jsonl"])
    ap.add_argument("--no-index", action="store_true", help="skip vector-store indexing")
    ap.add_argument("--limit", type=int, default=0, help="only import the first N records")
    ap.add_argument("--dry-run", action="store_true", help="validate only, write nothing")
    args = ap.parse_args()

    paths = sorted(glob.glob(args.path))
    if not paths:
        raise SystemExit(f"No files matched: {args.path}")

    records: list[dict] = []
    for pth in paths:
        recs = load_records(pth, args.format)
        log.info("Loaded %d record(s) from %s", len(recs), pth)
        records.extend(recs)

    if args.limit:
        records = records[: args.limit]

    # Validate everything up front.
    errors = 0
    for i, rec in enumerate(records, 1):
        try:
            normalize_record(rec)
        except Exception as exc:  # noqa: BLE001
            errors += 1
            log.error("record %d invalid: %s", i, exc)
    if errors:
        log.error("%d/%d records failed validation", errors, len(records))
        if args.dry_run:
            sys.exit(1)
        sys.exit(1)

    log.info("All %d records passed validation.", len(records))
    if args.dry_run:
        print("Dry run OK - nothing was written.")
        return

    repo = get_repository()
    log.info("Target: %s", summarise_target(repo))
    if repo.backend == "memory":
        log.warning("Repository is in-memory - imported data will not persist. Configure Supabase to persist.")

    ok = fail = 0
    results = []
    for i, rec in enumerate(records, 1):
        try:
            res = ingest_record(repo, rec, do_index=not args.no_index)
            results.append(res)
            ok += 1
            if i % 25 == 0 or i == len(records):
                log.info("progress %d/%d", i, len(records))
        except Exception as exc:  # noqa: BLE001
            fail += 1
            log.exception("record %d failed to import: %s", i, type(exc).__name__)

    print(json.dumps({"imported": ok, "failed": fail, "results": results[:20]}, indent=2))
    if fail:
        sys.exit(2)


if __name__ == "__main__":
    main()
