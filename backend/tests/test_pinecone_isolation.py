"""Vector store: patient isolation is mandatory and enforced."""
import pytest

from app.core.errors import PatientIsolationError
from app.services.pinecone_service import (
    InMemoryVectorStore,
    VectorRecord,
    get_vector_store,
)


def test_query_requires_patient_id():
    store = InMemoryVectorStore()
    with pytest.raises(PatientIsolationError):
        store.query("", "anything")
    with pytest.raises(PatientIsolationError):
        store.query(None, "anything")  # type: ignore[arg-type]


def test_upsert_requires_patient_id():
    store = InMemoryVectorStore()
    with pytest.raises(PatientIsolationError):
        store.upsert("", [VectorRecord(id="x", text="hello")])


def test_metadata_patient_mismatch_rejected():
    store = InMemoryVectorStore()
    with pytest.raises(PatientIsolationError):
        store.upsert("patient-A", [VectorRecord(id="x", text="hi", metadata={"patient_id": "patient-B"})])


def test_one_patient_cannot_retrieve_anothers_vectors():
    store = InMemoryVectorStore()
    store.upsert("patient-A", [VectorRecord(id="a1", text="patient A has hypertension and diabetes")])
    store.upsert("patient-B", [VectorRecord(id="b1", text="patient B has asthma")])

    a_hits = store.query("patient-A", "chronic disease history", top_k=10)
    b_hits = store.query("patient-B", "chronic disease history", top_k=10)

    assert {h.id for h in a_hits} == {"a1"}
    assert {h.id for h in b_hits} == {"b1"}
    assert all(h.metadata["patient_id"] == "patient-A" for h in a_hits)


def test_delete_is_scoped_to_patient():
    store = InMemoryVectorStore()
    store.upsert("patient-A", [VectorRecord(id="a1", text="A note")])
    store.upsert("patient-B", [VectorRecord(id="b1", text="B note")])
    store.delete_for_patient("patient-A")
    assert store.query("patient-A", "note") == []
    assert len(store.query("patient-B", "note")) == 1


def test_factory_returns_memory_store_without_key():
    assert get_vector_store().backend == "memory"
