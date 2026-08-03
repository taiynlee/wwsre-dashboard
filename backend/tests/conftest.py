import os

import pytest

os.environ.setdefault("GRAFANA_BASE_URL", "http://example.invalid:3000")
os.environ.setdefault("GRAFANA_POSTGRES_DATASOURCE_UID", "test-postgres-uid")
os.environ.setdefault("GRAFANA_PROMETHEUS_DATASOURCE_UID", "test-prometheus-uid")
# PG_HOST/PORT/USER/PASSWORD/DATABASE are *not* set here — they come from
# the real backend/.env (gitignored), same as the app itself uses; Settings
# reads that file directly. PG_SCHEMA is force-overridden (not setdefault)
# so tests can never land in the real `dashboard` schema no matter what
# .env says.
os.environ["PG_SCHEMA"] = "dashboard_test"


@pytest.fixture(autouse=True)
async def _isolated_postgres():
    """Every test starts with empty `sites` / `site_category_targets` tables
    in the dedicated dashboard_test schema — a real Postgres round trip
    (not a mock), isolated from the real `dashboard` schema's data by
    PG_SCHEMA above.

    The connection pool is closed and rebuilt around every test rather than
    reused: pytest-asyncio gives each test function its own event loop by
    default, and an asyncpg pool's connections are bound to whichever loop
    was running when they were created — reusing one across tests raises
    "Event loop is closed" the moment a later test tries to use a
    connection opened under an earlier, now-dead loop. The app itself never
    hits this (one process, one loop, for its whole lifetime)."""
    from app.db import close_db, get_db, init_db

    await close_db()
    await init_db()
    async with get_db() as conn:
        await conn.execute("TRUNCATE site_category_targets, sites CASCADE")
    yield
    await close_db()


@pytest.fixture(autouse=True)
def _isolated_grafana_cache():
    """Each test starts with an empty cachetools cache — no leaking cached
    responses from one test's FakeGrafanaClient into the next test."""
    from app.cache import clear_cache

    clear_cache()
    yield
    clear_cache()
