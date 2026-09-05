def test_health_is_trivial_and_ok(client):
    """GET /api/health must be dependency-free and always 200."""
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "MACI API"}


def test_plain_health_and_healthz(client):
    for path in ("/health", "/healthz", "/api/healthz"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert r.json()["status"] == "ok"


def test_health_details_capability_probe(client):
    r = client.get("/api/health/details")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    # Integrations report booleans only - never key values.
    assert set(body["integrations"]) == {"groq", "ocr_space", "pinecone", "supabase"}
    assert all(v is False for v in body["integrations"].values())
    assert body["runtime"]["repository"] == "memory"
    assert body["runtime"]["vector_store"] == "memory"


def test_health_never_leaks_secrets(client):
    for path in ("/api/health", "/api/health/details", "/"):
        r = client.get(path)
        assert "gsk_" not in r.text and "pcsk_" not in r.text and "sb_" not in r.text


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "MACI"
    assert body["service"] == "MACI API"
