"""(Re)build the Pinecone (or in-memory) vector index from stored records.

    python scripts/index_pinecone.py --all                 # every patient in the DB
    python scripts/index_pinecone.py --patient <patient_id>
    python scripts/index_pinecone.py --from-file data/real/records.jsonl
    python scripts/index_pinecone.py --create-index        # create the Pinecone index if missing

Embeddings come from the configured embedding provider (default: offline
deterministic). Patient isolation (namespace + patient_id metadata filter) is
enforced by the vector-store layer itself.
"""
from __future__ import annotations

import argparse
import json

from _maci_ingest import (
    get_repository,
    index_patient,
    ingest_record,
    load_records,
    log,
    summarise_target,
)


def _create_index_if_configured() -> None:
    from app.core.config import settings

    if not settings.pinecone_api_key:
        log.warning("PINECONE_API_KEY not set - nothing to create (using in-memory store).")
        return
    try:
        from pinecone import Pinecone, ServerlessSpec

        pc = Pinecone(api_key=settings.pinecone_api_key)
        names = [ix["name"] for ix in pc.list_indexes()]
        if settings.pinecone_index_name in names:
            log.info("Pinecone index '%s' already exists.", settings.pinecone_index_name)
            return
        log.info("Creating Pinecone index '%s' (dim=%d, metric=%s)...",
                 settings.pinecone_index_name, settings.pinecone_dimension, settings.pinecone_metric)
        pc.create_index(
            name=settings.pinecone_index_name,
            dimension=settings.pinecone_dimension,
            metric=settings.pinecone_metric,
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        log.info("Index created.")
    except Exception as exc:  # noqa: BLE001
        log.error("Could not create Pinecone index: %s", type(exc).__name__)


def main() -> None:
    ap = argparse.ArgumentParser(description="Index MACI records into the vector store")
    ap.add_argument("--all", action="store_true", help="reindex every patient found in the repository")
    ap.add_argument("--patient", help="reindex a single patient id")
    ap.add_argument("--from-file", help="ingest records from a file first, then index them")
    ap.add_argument("--format", default="auto", choices=["auto", "csv", "json", "jsonl"])
    ap.add_argument("--create-index", action="store_true", help="create the Pinecone index if it does not exist")
    args = ap.parse_args()

    if args.create_index:
        _create_index_if_configured()

    repo = get_repository()
    log.info("Target: %s", summarise_target(repo))

    total_vectors = 0
    touched: list[str] = []

    if args.from_file:
        for rec in load_records(args.from_file, args.format):
            res = ingest_record(repo, rec, do_index=True)
            touched.append(res["patient_id"])
            total_vectors += res["vectors_indexed"]

    if args.patient:
        n = index_patient(repo, args.patient)
        touched.append(args.patient)
        total_vectors += n

    if args.all:
        patients = repo.list("patients")
        log.info("Reindexing %d patient(s)...", len(patients))
        for p in patients:
            n = index_patient(repo, p["id"])
            touched.append(str(p["id"]))
            total_vectors += n
            log.info("  patient %s -> %d vectors", p["id"], n)

    if not (args.all or args.patient or args.from_file):
        ap.error("nothing to do - pass --all, --patient <id> or --from-file <path>")

    print(json.dumps({"patients_indexed": sorted(set(touched)), "vectors_upserted": total_vectors}, indent=2))
    if repo.backend == "memory":
        log.warning("In-memory store: this index lives only for this process.")


if __name__ == "__main__":
    main()
