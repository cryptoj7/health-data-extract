"""Activity logs are written by middleware on each request and exposed via API."""


def test_activity_log_records_request(client):
    # Make a known request that should be logged
    r = client.post(
        "/api/v1/orders",
        json={
            "patient_first_name": "Test",
            "patient_last_name": "Patient",
        },
    )
    assert r.status_code == 201

    # Activity log endpoint should now contain at least the create + this list call
    r = client.get("/api/v1/activity-logs?path_contains=orders")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(item["path"] == "/api/v1/orders" and item["method"] == "POST" for item in body["items"])


def test_activity_log_pagination(client):
    for _ in range(3):
        client.get("/api/v1/orders")
    r = client.get("/api/v1/activity-logs?limit=2&offset=0")
    assert r.status_code == 200
    body = r.json()
    assert body["limit"] == 2
    assert len(body["items"]) <= 2
