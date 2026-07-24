from fastapi.testclient import TestClient


def test_public_health():
    from app.main_public import app

    with TestClient(app) as client:
        resp = client.get("/api/public/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_admin_health():
    from app.main_admin import app

    with TestClient(app) as client:
        resp = client.get("/api/admin/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
