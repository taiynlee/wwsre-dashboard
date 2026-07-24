import os

import pytest

os.environ.setdefault("GRAFANA_BASE_URL", "http://example.invalid:3000")
os.environ.setdefault("GRAFANA_POSTGRES_DATASOURCE_UID", "test-postgres-uid")
os.environ.setdefault("GRAFANA_PROMETHEUS_DATASOURCE_UID", "test-prometheus-uid")


@pytest.fixture(autouse=True)
def _isolated_sqlite(tmp_path, monkeypatch):
    """Point every test at a throwaway SQLite file instead of the real dev DB."""
    from app.config import get_settings

    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "test.db"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _isolated_grafana_cache():
    """Each test starts with an empty cachetools cache — no leaking cached
    responses from one test's FakeGrafanaClient into the next test."""
    from app.cache import clear_cache

    clear_cache()
    yield
    clear_cache()
