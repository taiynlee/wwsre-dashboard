from app.cache import CachedResult
from app.db import get_db, utcnow
from app.grafana_client import GrafanaClient
from app.schemas import SiteCategoryTargetIn
from app.services import slo_service

DEFAULT_TARGET_PCT = slo_service.TARGET_DEFAULT_PCT


async def _fetch_site_category_rows(site_code: str) -> dict[str, dict]:
    async with get_db() as conn:
        rows = await conn.fetch(
            "SELECT category, target_pct, included FROM site_category_targets WHERE site_code = $1",
            site_code,
        )
        return {row["category"]: dict(row) for row in rows}


async def get_site_category_settings(grafana: GrafanaClient, datasource_uid: str, site_code: str) -> CachedResult:
    """Every known category for this site, merging its stored target/included
    settings with defaults (target 99.0%, included) for any category that
    hasn't been explicitly configured yet."""
    known = await slo_service.list_known_categories(grafana, datasource_uid)
    stored = await _fetch_site_category_rows(site_code)

    settings = [
        {
            "site_code": site_code,
            "category": category,
            "target_pct": stored[category]["target_pct"] if category in stored else DEFAULT_TARGET_PCT,
            "included": stored[category]["included"] if category in stored else True,
        }
        for category in known.value
    ]
    return CachedResult(value=settings, stale=known.stale)


async def replace_site_category_settings(site_code: str, items: list[SiteCategoryTargetIn]) -> list[dict]:
    """PUT semantics: the given list becomes the entire per-category setting set for this site."""
    now = utcnow()
    async with get_db() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM site_category_targets WHERE site_code = $1", site_code)
            for item in items:
                await conn.execute(
                    """
                    INSERT INTO site_category_targets (site_code, category, target_pct, included, updated_at)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    site_code,
                    item.category,
                    item.target_pct,
                    item.included,
                    now,
                )

    return [
        {"site_code": site_code, "category": i.category, "target_pct": i.target_pct, "included": i.included}
        for i in items
    ]


async def fetch_all_site_category_settings() -> dict[str, dict[str, dict]]:
    """Every configured (site_code, category) row, keyed by site_code then
    category — used by slo_service to resolve every site's overview in one
    fresh read instead of one query per site."""
    async with get_db() as conn:
        rows = await conn.fetch("SELECT site_code, category, target_pct, included FROM site_category_targets")

    by_site: dict[str, dict[str, dict]] = {}
    for row in rows:
        by_site.setdefault(row["site_code"], {})[row["category"]] = dict(row)
    return by_site
