from typing import Any

import httpx

from app.config import get_settings


class GrafanaQueryError(RuntimeError):
    """Raised when Grafana's /api/ds/query proxy returns an error for a query."""


class GrafanaClient:
    """Thin wrapper around Grafana's own query proxy — we never talk to Postgres
    or Prometheus directly, only through Grafana's `/api/ds/query` and
    `/api/datasources/proxy` endpoints (anonymous read access)."""

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._base_url = settings.grafana_base_url.rstrip("/")
        self._client = client or httpx.AsyncClient(base_url=self._base_url, timeout=10.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def query_sql(self, datasource_uid: str, sql: str) -> list[dict[str, Any]]:
        """Run a SQL query against a Postgres datasource, returned as a list of row dicts."""
        resp = await self._client.post(
            "/api/ds/query",
            json={
                "queries": [
                    {
                        "refId": "A",
                        "datasource": {"uid": datasource_uid},
                        "rawSql": sql,
                        "format": "table",
                    }
                ]
            },
        )
        resp.raise_for_status()
        payload = resp.json()
        result = payload["results"]["A"]
        if error := result.get("error"):
            raise GrafanaQueryError(error)

        frames = result.get("frames") or []
        if not frames:
            return []

        fields = frames[0]["schema"]["fields"]
        columns = frames[0]["data"]["values"]
        names = [f["name"] for f in fields]

        rows = []
        row_count = len(columns[0]) if columns else 0
        for i in range(row_count):
            rows.append({names[c]: columns[c][i] for c in range(len(names))})
        return rows

    async def query_promql_instant(self, datasource_uid: str, expr: str) -> list[dict[str, Any]]:
        """Run an instant PromQL query, returned as Prometheus's raw `result` list."""
        resp = await self._client.get(
            f"/api/datasources/proxy/uid/{datasource_uid}/api/v1/query",
            params={"query": expr},
        )
        resp.raise_for_status()
        payload = resp.json()
        if payload.get("status") != "success":
            raise GrafanaQueryError(payload)
        return payload["data"]["result"]
