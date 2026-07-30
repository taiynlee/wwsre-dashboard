import pytest

from app.db import init_db
from app.services.slo_service import (
    SiteNotFoundError,
    get_category_health,
    get_cluster_category_health,
    get_cluster_count,
    get_global_trend,
    get_site_category_health,
    get_site_clusters,
)
from tests.helpers import FakeGrafanaClient, insert_site


async def test_get_site_clusters_returns_per_cluster_breakdown():
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
            [
                {"cluster_id": "aaa-prd-01", "create_at": "2026-06-01", "slo": 99.9},
                {"cluster_id": "aaa-prd-01", "create_at": "2026-06-08", "slo": 99.7},
                {"cluster_id": "aaa-qas-01", "create_at": "2026-06-01", "slo": 60.0},
            ],
            [],  # no known categories configured -> falls back to the 99.0 default target
        ]
    )

    result = (await get_site_clusters(grafana, "test-uid", "AAA")).value

    by_id = {c.cluster_id: c for c in result}
    assert by_id["aaa-prd-01"].current_pct == 99.7
    assert by_id["aaa-prd-01"].tier == "good"
    assert by_id["aaa-qas-01"].current_pct == 60.0
    assert by_id["aaa-qas-01"].tier == "crit"
    # site's cluster_prefix should have been used as the LIKE pattern
    assert "aaa%" in grafana.sql_calls[0][1]


async def test_get_site_clusters_raises_for_unknown_site():
    await init_db()
    grafana = FakeGrafanaClient()

    with pytest.raises(SiteNotFoundError):
        await get_site_clusters(grafana, "test-uid", "NOPE")


async def test_get_category_health_computes_tier_from_average():
    await init_db()
    grafana = FakeGrafanaClient(
        sql_rows=[
            {"category": "K8S-ETCD", "avgslo": 99.5, "worst": 84.5},
            {"category": "K8S-ArgoCD", "avgslo": 69.6, "worst": 0.0},
        ]
    )

    result = (await get_category_health(grafana, "test-uid")).value

    by_name = {c.category: c for c in result}
    assert by_name["K8S-ETCD"].tier == "good"
    assert by_name["K8S-ArgoCD"].tier == "crit"
    assert by_name["K8S-ArgoCD"].worst_pct == 0.0


async def test_get_site_category_health_scopes_to_site_prefix():
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(
        sql_rows=[
            {"category": "K8S-Node", "avgslo": 99.9, "worst": 99.5},
            {"category": "K8S-ArgoCD", "avgslo": 40.0, "worst": 0.0},
        ]
    )

    result = (await get_site_category_health(grafana, "test-uid", "AAA")).value

    by_name = {c.category: c for c in result}
    assert by_name["K8S-Node"].tier == "good"
    assert by_name["K8S-ArgoCD"].tier == "crit"
    assert "aaa%" in grafana.sql_calls[0][1]


async def test_get_site_category_health_raises_for_unknown_site():
    await init_db()
    grafana = FakeGrafanaClient()

    with pytest.raises(SiteNotFoundError):
        await get_site_category_health(grafana, "test-uid", "NOPE")


async def test_get_cluster_category_health_scopes_to_one_cluster():
    """A site-wide 'everything's 100' breakdown can disagree with any one of
    its clusters — this is what lets a hovered cluster card show what's
    actually dragging *that* cluster down."""
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(
        sql_rows=[
            {"category": "K8S-Node", "avgslo": 100.0, "worst": 100.0},
            {"category": "K8S-ArgoCD", "avgslo": 97.0, "worst": 90.0},
        ]
    )

    result = (await get_cluster_category_health(grafana, "test-uid", "aaa-prd-01")).value

    by_name = {c.category: c for c in result}
    assert by_name["K8S-Node"].tier == "good"
    assert by_name["K8S-ArgoCD"].tier == "warn"
    # exact cluster_id should have been used, not a LIKE prefix match
    assert "cluster_id = 'aaa-prd-01'" in grafana.sql_calls[0][1]


async def test_get_cluster_category_health_raises_for_unknown_cluster_prefix():
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient()

    with pytest.raises(SiteNotFoundError):
        await get_cluster_category_health(grafana, "test-uid", "zzz-prd-01")


async def test_get_global_trend_drops_trailing_partial_week():
    await init_db()
    grafana = FakeGrafanaClient(
        sql_rows=[
            {"create_at": "2026-06-01", "avg_slo": 98.0},
            {"create_at": "2026-06-08", "avg_slo": 99.0},
            {"create_at": "2026-06-15", "avg_slo": 0},
        ]
    )

    result = await get_global_trend(grafana, "test-uid")

    assert [p.avg_pct for p in result] == [98.0, 99.0]


async def test_get_cluster_count_returns_the_row_value():
    await init_db()
    grafana = FakeGrafanaClient(sql_rows=[{"n": 54}])

    result = await get_cluster_count(grafana, "test-uid")

    assert result == 54


async def test_get_cluster_count_returns_zero_when_no_rows():
    await init_db()
    grafana = FakeGrafanaClient(sql_rows=[])

    result = await get_cluster_count(grafana, "test-uid")

    assert result == 0
