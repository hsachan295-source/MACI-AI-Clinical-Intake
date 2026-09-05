"""Pinecone vector store for semantic retrieval (RAG).

Pinecone is used **only** for semantic search over medical-record chunks - it is
never the system of record (that is Supabase/PostgreSQL).

Patient isolation is enforced on every operation, two ways:
  1. a per-patient **namespace** (``patient::<id>``)
  2. a mandatory ``patient_id`` **metadata filter** on every query

``query()`` will raise if called without a ``patient_id``. When Pinecone is not
configured, an in-process cosine-similarity store is used so RAG still works
locally and in tests.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.core.config import settings
from app.core.errors import PatientIsolationError
from app.core.logging import get_logger
from app.services.embedding_service import cosine_similarity, get_embedder

log = get_logger("services.pinecone")


@dataclass
class VectorRecord:
    id: str
    text: str
    metadata: dict = field(default_factory=dict)
    values: list[float] | None = None


@dataclass
class Match:
    id: str
    score: float
    text: str
    metadata: dict = field(default_factory=dict)


def _namespace(patient_id: str) -> str:
    return f"patient::{patient_id}"


def _require_patient(patient_id: str | None) -> str:
    pid = (str(patient_id) if patient_id is not None else "").strip()
    if not pid:
        raise PatientIsolationError("patient_id is required for every vector operation")
    return pid


class BaseVectorStore:
    backend = "base"

    def upsert(self, patient_id: str, records: list[VectorRecord]) -> int:  # pragma: no cover
        raise NotImplementedError

    def query(
        self, patient_id: str, text: str, *, top_k: int = 5, extra_filter: dict | None = None
    ) -> list[Match]:  # pragma: no cover
        raise NotImplementedError

    def delete_for_patient(self, patient_id: str) -> None:  # pragma: no cover
        raise NotImplementedError


class InMemoryVectorStore(BaseVectorStore):
    backend = "memory"

    def __init__(self) -> None:
        # namespace -> list[(record, vector)]
        self._data: dict[str, list[tuple[VectorRecord, list[float]]]] = {}
        self._embedder = get_embedder()

    def upsert(self, patient_id: str, records: list[VectorRecord]) -> int:
        pid = _require_patient(patient_id)
        ns = _namespace(pid)
        bucket = self._data.setdefault(ns, [])
        to_embed = [r for r in records if not r.values]
        vectors = self._embedder.embed([r.text for r in to_embed]) if to_embed else []
        vmap = {id(r): v for r, v in zip(to_embed, vectors)}
        by_id = {r.id: i for i, (r, _) in enumerate(bucket)}
        for r in records:
            r.metadata.setdefault("patient_id", pid)
            if str(r.metadata.get("patient_id")) != pid:
                raise PatientIsolationError("Vector metadata patient_id does not match namespace")
            vec = r.values or vmap.get(id(r)) or self._embedder.embed_one(r.text)
            if r.id in by_id:
                bucket[by_id[r.id]] = (r, vec)
            else:
                bucket.append((r, vec))
        return len(records)

    def query(
        self, patient_id: str, text: str, *, top_k: int = 5, extra_filter: dict | None = None
    ) -> list[Match]:
        pid = _require_patient(patient_id)
        bucket = self._data.get(_namespace(pid), [])
        if not bucket:
            return []
        qv = self._embedder.embed_one(text)
        scored: list[Match] = []
        for rec, vec in bucket:
            if str(rec.metadata.get("patient_id")) != pid:  # defence in depth
                continue
            if extra_filter and not _matches_filter(rec.metadata, extra_filter):
                continue
            scored.append(
                Match(id=rec.id, score=cosine_similarity(qv, vec), text=rec.text, metadata=rec.metadata)
            )
        scored.sort(key=lambda m: m.score, reverse=True)
        return scored[: max(1, top_k)]

    def delete_for_patient(self, patient_id: str) -> None:
        self._data.pop(_namespace(_require_patient(patient_id)), None)


class PineconeUnavailable(RuntimeError):
    """Raised internally when Pinecone cannot be reached; callers fall back."""


class PineconeVectorStore(BaseVectorStore):
    backend = "pinecone"

    def __init__(self) -> None:
        # NOTHING here touches the network or imports the pinecone package.
        # Serverless-safe: construction never fails. The real client is created
        # lazily on first use in ``_ensure_ready()``.
        self._embedder = get_embedder()
        self._index = None
        self.index_dimension: int = settings.pinecone_dimension
        self._ready = False
        self._failed = False

    def _ensure_ready(self) -> None:
        """Create the Pinecone client + detect index dimension on first use."""
        if self._ready:
            return
        if self._failed:
            raise PineconeUnavailable("Pinecone previously unreachable this process")
        try:
            from pinecone import Pinecone  # heavy import deferred to first use

            from app.services.embedding_service import HashingEmbedder

            pc = Pinecone(api_key=settings.pinecone_api_key)
            if settings.pinecone_host:
                self._index = pc.Index(host=settings.pinecone_host)
            else:
                self._index = pc.Index(settings.pinecone_index_name)

            stats = self._index.describe_index_stats()
            index_dim = getattr(stats, "dimension", None)
            if index_dim is None and isinstance(stats, dict):
                index_dim = stats.get("dimension")
            self.index_dimension = int(index_dim) if index_dim else settings.pinecone_dimension

            if self._embedder.dimension != self.index_dimension and isinstance(self._embedder, HashingEmbedder):
                log.warning(
                    "Offline embedder dim %d != Pinecone index dim %d - adapting to %d",
                    self._embedder.dimension, self.index_dimension, self.index_dimension,
                )
                self._embedder = HashingEmbedder(dimension=self.index_dimension)
            elif self._embedder.dimension != self.index_dimension:
                log.error(
                    "Embedding model '%s' outputs %d dims but the index expects %d - upserts will fail.",
                    self._embedder.name, self._embedder.dimension, self.index_dimension,
                )
            self._ready = True
            log.info("Pinecone index ready (dim=%d, embedder=%s/%d)",
                     self.index_dimension, self._embedder.name, self._embedder.dimension)
        except BaseException as exc:  # noqa: BLE001 - never let Pinecone break a request
            self._failed = True
            raise PineconeUnavailable(f"Pinecone unavailable: {type(exc).__name__}") from exc

    def upsert(self, patient_id: str, records: list[VectorRecord]) -> int:
        self._ensure_ready()
        pid = _require_patient(patient_id)
        ns = _namespace(pid)
        texts = [r.text for r in records if not r.values]
        vectors = self._embedder.embed(texts) if texts else []
        it = iter(vectors)
        items = []
        for r in records:
            r.metadata.setdefault("patient_id", pid)
            if str(r.metadata.get("patient_id")) != pid:
                raise PatientIsolationError("Vector metadata patient_id mismatch")
            values = r.values or next(it)
            md = {**r.metadata, "text": r.text[:2000]}
            items.append({"id": r.id, "values": list(map(float, values)), "metadata": md})
        for i in range(0, len(items), 100):
            self._index.upsert(vectors=items[i : i + 100], namespace=ns)
        return len(items)

    def query(
        self, patient_id: str, text: str, *, top_k: int = 5, extra_filter: dict | None = None
    ) -> list[Match]:
        self._ensure_ready()
        pid = _require_patient(patient_id)
        flt: dict = {"patient_id": {"$eq": pid}}  # ALWAYS enforced
        if extra_filter:
            flt = {"$and": [flt, extra_filter]}
        qv = self._embedder.embed_one(text)
        res = self._index.query(
            vector=list(map(float, qv)),
            top_k=max(1, top_k),
            include_metadata=True,
            namespace=_namespace(pid),
            filter=flt,
        )
        out: list[Match] = []
        for m in getattr(res, "matches", None) or res.get("matches", []):
            md = getattr(m, "metadata", None) or (m.get("metadata") if isinstance(m, dict) else {}) or {}
            if str(md.get("patient_id")) != pid:  # defence in depth
                continue
            out.append(
                Match(
                    id=getattr(m, "id", None) or m.get("id"),
                    score=float(getattr(m, "score", None) or m.get("score") or 0.0),
                    text=str(md.get("text", "")),
                    metadata={k: v for k, v in md.items() if k != "text"},
                )
            )
        return out

    def delete_for_patient(self, patient_id: str) -> None:
        pid = _require_patient(patient_id)
        try:
            self._ensure_ready()
            self._index.delete(delete_all=True, namespace=_namespace(pid))
        except Exception as exc:  # pragma: no cover
            log.warning("Pinecone delete failed: %s", type(exc).__name__)


def _matches_filter(metadata: dict, flt: dict) -> bool:
    for key, cond in flt.items():
        val = metadata.get(key)
        if isinstance(cond, dict):
            if "$eq" in cond and val != cond["$eq"]:
                return False
            if "$in" in cond and val not in cond["$in"]:
                return False
            if "$ne" in cond and val == cond["$ne"]:
                return False
        elif val != cond:
            return False
    return True


_store: BaseVectorStore | None = None


def get_vector_store() -> BaseVectorStore:
    global _store
    if _store is not None:
        return _store
    if settings.pinecone_enabled:
        try:
            _store = PineconeVectorStore()  # construction does NO network I/O
            return _store
        except BaseException as exc:  # noqa: BLE001 - must never break app startup
            log.warning("Pinecone init skipped (%s) - using in-memory vector store", type(exc).__name__)
    else:
        log.info("Pinecone not configured - using in-memory vector store")
    _store = InMemoryVectorStore()
    return _store


def reset_vector_store() -> None:
    global _store
    _store = None
