import pytest

from app.services.live_service import LIVE_METRICS, get_cluster_live
from tests.helpers import FakeGrafanaClient


async def test_returns_metrics_for_local_cluster():
    promql_results = {expr: [{"value": [0, "42.5"]}] for expr in LIVE_METRICS.values()}
    grafana = FakeGrafanaClient(promql_results=promql_results)

    result = await get_cluster_live(
        grafana,
        prometheus_uid="prom-uid",
        postgres_uid="pg-uid",
        cluster_id="local-prd-01",
        local_cluster_id="local-prd-01",
    )

    assert result.available is True
    assert result.metrics == {name: 42.5 for name in LIVE_METRICS}


async def test_falls_back_to_external_url_for_other_clusters():
    grafana = FakeGrafanaClient(sql_rows=[{"url": "https://grafana.example/other-cluster"}])

    result = await get_cluster_live(
        grafana,
        prometheus_uid="prom-uid",
        postgres_uid="pg-uid",
        cluster_id="other-prd-01",
        local_cluster_id="local-prd-01",
    )

    assert result.available is False
    assert result.external_url == "https://grafana.example/other-cluster"
    assert result.metrics is None
    # must not touch Prometheus at all for a non-local cluster
    assert grafana.promql_calls == []


async def test_external_url_is_none_when_mapping_missing():
    grafana = FakeGrafanaClient(sql_rows=[])

    result = await get_cluster_live(
        grafana,
        prometheus_uid="prom-uid",
        postgres_uid="pg-uid",
        cluster_id="unmapped-prd-01",
        local_cluster_id="local-prd-01",
    )

    assert result.available is False
    assert result.external_url is None


async def test_rejects_cluster_id_with_sql_metacharacters():
    grafana = FakeGrafanaClient(sql_rows=[])

    with pytest.raises(ValueError):
        await get_cluster_live(
            grafana,
            prometheus_uid="prom-uid",
            postgres_uid="pg-uid",
            cluster_id="a'; drop table slo; --",
            local_cluster_id="local-prd-01",
        )
