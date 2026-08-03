from fastapi.testclient import TestClient

from app.cache import clear_cache
from app.dependencies import get_grafana_client
from app.db import init_db, utcnow
from app.db import get_db as get_db_ctx


class FlakyGrafanaClient:
    """Succeeds for the first fetch's queries, then fails every call after —
    for exercising the stale-fallback path through a real HTTP round trip.
    `get_sites_overview` issues four queries per fetch (trend, per-cluster
    current, cluster count, known categories)."""

    def __init__(self) -> None:
        self.call_count = 0

    async def query_sql(self, datasource_uid: str, sql: str) -> list[dict]:
        self.call_count += 1
        if self.call_count == 1:
            return [{"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-01", "avgslo": 99.5, "n": 1}]
        if self.call_count == 2:
            return [{"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-01", "slo": 99.5}]
        if self.call_count == 3:
            return [{"site": "aaa", "n": 1}]
        if self.call_count == 4:
            return [{"category": "K8S-Node"}]
        raise RuntimeError("grafana unreachable")


async def _insert_site() -> None:
    now = utcnow()
    async with get_db_ctx() as conn:
        await conn.execute(
            """
            INSERT INTO sites (code, display_name, country, latitude, longitude, cluster_prefix, enabled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
            """,
            "AAA",
            "Test City",
            "Test Country",
            1.0,
            2.0,
            "aaa",
            now,
            now,
        )


async def test_sites_endpoint_serves_stale_data_when_grafana_goes_down():
    await init_db()
    await _insert_site()
    clear_cache()

    from app.main_public import app
    from app import cache as cache_module

    flaky = FlakyGrafanaClient()
    app.dependency_overrides[get_grafana_client] = lambda: flaky

    try:
        with TestClient(app) as client:
            first = client.get("/api/public/sites")
            assert first.status_code == 200
            assert first.headers["x-stale-data"] == "false"

            # force the TTL entry to "expire" without losing the last-good record
            del cache_module._cache["grafana:sites-overview:test-postgres-uid"]

            second = client.get("/api/public/sites")
            assert second.status_code == 200
            assert second.headers["x-stale-data"] == "true"
            assert second.json() == first.json()  # same data, just marked stale
    finally:
        app.dependency_overrides.clear()
        clear_cache()
