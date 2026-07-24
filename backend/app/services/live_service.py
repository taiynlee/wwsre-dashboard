from dataclasses import dataclass

from app.grafana_client import GrafanaClient
from app.sql_safety import safe_identifier

# A small, curated set of representative live gauges — not a full rebuild of every
# per-component SLI panel. Each cluster's own Grafana (external_url) has the rest.
LIVE_METRICS = {
    "cpu_usage_pct": (
        '100*(1-(sum(rate(node_cpu_seconds_total{mode="idle"}[5m]))'
        "/sum(rate(node_cpu_seconds_total[5m]))))"
    ),
    "memory_usage_pct": (
        "100*(1-(sum(node_memory_MemAvailable_bytes)/sum(node_memory_MemTotal_bytes)))"
    ),
    "api_server_error_rate_pct": (
        '100*sum(code_resource:apiserver_request_total:rate5m{code=~"5.."})'
        "/sum(code_resource:apiserver_request_total:rate5m)"
    ),
}


@dataclass
class LiveClusterMetrics:
    available: bool
    metrics: dict[str, float | None] | None = None
    external_url: str | None = None


async def _lookup_external_url(grafana: GrafanaClient, postgres_uid: str, cluster_id: str) -> str | None:
    safe_id = safe_identifier(cluster_id)
    rows = await grafana.query_sql(
        postgres_uid,
        f"select url from grafana_mapping where cluster_id = '{safe_id}'",
    )
    return rows[0]["url"] if rows else None


async def get_cluster_live(
    grafana: GrafanaClient,
    *,
    prometheus_uid: str,
    postgres_uid: str,
    cluster_id: str,
    local_cluster_id: str,
) -> LiveClusterMetrics:
    """Live Prometheus SLI is only reachable for the one cluster local to this Grafana
    instance. Every other cluster falls back to a link into its own Grafana."""
    if not local_cluster_id or cluster_id != local_cluster_id:
        url = await _lookup_external_url(grafana, postgres_uid, cluster_id)
        return LiveClusterMetrics(available=False, external_url=url)

    metrics: dict[str, float | None] = {}
    for name, expr in LIVE_METRICS.items():
        result = await grafana.query_promql_instant(prometheus_uid, expr)
        metrics[name] = float(result[0]["value"][1]) if result else None

    return LiveClusterMetrics(available=True, metrics=metrics)
