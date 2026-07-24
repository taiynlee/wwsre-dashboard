from app.db import get_db, utcnow_iso


class FakeGrafanaClient:
    """Stands in for GrafanaClient in tests — no real network calls.

    `sql_rows` is returned for every `query_sql` call (simple case: one query).
    For services that issue multiple different queries, pass `sql_rows_sequence`
    instead — one row-list per call, in order; it takes priority over `sql_rows`.
    """

    def __init__(
        self,
        sql_rows: list[dict] | None = None,
        sql_rows_sequence: list[list[dict]] | None = None,
        promql_results: dict[str, list[dict]] | None = None,
    ) -> None:
        self.sql_rows = sql_rows or []
        self.sql_rows_sequence = list(sql_rows_sequence) if sql_rows_sequence is not None else None
        self.promql_results = promql_results or {}
        self.sql_calls: list[tuple[str, str]] = []
        self.promql_calls: list[tuple[str, str]] = []

    async def query_sql(self, datasource_uid: str, sql: str) -> list[dict]:
        self.sql_calls.append((datasource_uid, sql))
        if self.sql_rows_sequence is not None:
            return self.sql_rows_sequence.pop(0) if self.sql_rows_sequence else []
        return self.sql_rows

    async def query_promql_instant(self, datasource_uid: str, expr: str) -> list[dict]:
        self.promql_calls.append((datasource_uid, expr))
        return self.promql_results.get(expr, [])


async def insert_site(code: str, prefix: str) -> None:
    now = utcnow_iso()
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO sites (code, display_name, country, latitude, longitude, cluster_prefix, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (code, f"{code} City", f"{code} Country", 1.0, 2.0, prefix, now, now),
        )
        await db.commit()
