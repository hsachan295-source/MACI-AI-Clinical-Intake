"""Embedding abstraction layer.

Priority order (configurable via ``EMBEDDING_PROVIDER``):

1. ``fastembed``               - small, fast, no torch dependency
2. ``sentence-transformers``   - widely used, heavier
3. deterministic hashing       - offline, zero-dependency fallback (default)

The hashing embedder is *not* semantically meaningful across unrelated words,
but it is stable, fast and lets the whole RAG pipeline (and its tests) run with
no model download and no network. Swap in a real model by installing one of the
optional packages and setting ``EMBEDDING_PROVIDER``.
"""
from __future__ import annotations

import hashlib
import math
import re
from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("services.embedding")

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class BaseEmbedder:
    name: str = "base"
    dimension: int = settings.embedding_dimension

    def embed(self, texts: list[str]) -> list[list[float]]:  # pragma: no cover
        raise NotImplementedError

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


class HashingEmbedder(BaseEmbedder):
    """Deterministic bag-of-hashed-tokens embedding, L2-normalised."""

    name = "hashing-offline"

    def __init__(self, dimension: int | None = None) -> None:
        self.dimension = dimension or settings.embedding_dimension

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dimension
        tokens = _TOKEN_RE.findall((text or "").lower())
        if not tokens:
            return vec
        # unigrams + bigrams for a little context sensitivity
        grams = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]
        for gram in grams:
            h = hashlib.sha1(gram.encode("utf-8")).digest()
            idx = int.from_bytes(h[:4], "big") % self.dimension
            sign = 1.0 if h[4] & 1 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]


class FastEmbedEmbedder(BaseEmbedder):
    name = "fastembed"

    def __init__(self, model_name: str) -> None:
        from fastembed import TextEmbedding  # type: ignore

        self._model = TextEmbedding(model_name=model_name)
        self.dimension = len(next(iter(self._model.embed(["dimension probe"]))))

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [list(map(float, v)) for v in self._model.embed(list(texts))]


class SentenceTransformerEmbedder(BaseEmbedder):
    name = "sentence-transformers"

    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer  # type: ignore

        self._model = SentenceTransformer(model_name)
        self.dimension = int(self._model.get_sentence_embedding_dimension())

    def embed(self, texts: list[str]) -> list[list[float]]:
        vecs = self._model.encode(list(texts), normalize_embeddings=True)
        return [list(map(float, v)) for v in vecs]


@lru_cache
def get_embedder() -> BaseEmbedder:
    provider = (settings.embedding_provider or "auto").lower()
    model = settings.embedding_model

    if provider in ("hash", "hashing", "offline"):
        return HashingEmbedder()

    if provider in ("auto", "fastembed"):
        try:
            emb = FastEmbedEmbedder(model)
            log.info("Embeddings: fastembed (%s, dim=%d)", model, emb.dimension)
            return emb
        except Exception as exc:
            if provider == "fastembed":
                log.warning("fastembed requested but unavailable (%s)", type(exc).__name__)

    if provider in ("auto", "sentence-transformers", "st"):
        try:
            emb = SentenceTransformerEmbedder(model)
            log.info("Embeddings: sentence-transformers (%s, dim=%d)", model, emb.dimension)
            return emb
        except Exception as exc:
            if provider not in ("auto",):
                log.warning("sentence-transformers unavailable (%s)", type(exc).__name__)

    log.info("Embeddings: deterministic offline hashing embedder (dim=%d)", settings.embedding_dimension)
    return HashingEmbedder()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
