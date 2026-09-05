def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    # Integrations report booleans only - never key values.
    assert set(body["integrations"]) == {"groq", "ocr_space", "pinecone", "supabase"}
    assert all(v is False for v in body["integrations"].values())
    assert body["runtime"]["repository"] == "memory"
    assert body["runtime"]["vector_store"] == "memory"


def test_health_never_leaks_secrets(client):
    r = client.get("/api/health")
    assert "gsk_" not in r.text and "pcsk_" not in r.text and "sb_" not in r.text


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "MACI"
