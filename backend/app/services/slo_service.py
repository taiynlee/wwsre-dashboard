from dataclasses import dataclass, field

from app.cache import CachedResult, cached
from app.db import get_db
from app.grafana_client import GrafanaClient
from app.sql_safety import safe_identifier

HISTORY_WINDOW_DAYS = 70
TARGET_DEFAULT_PCT = 99.0
WARN_FLOOR_PCT = 95.0


@dataclass
class SiteStatus:
    code: str
    display_name: str
    country: str
    latitude: float
    longitude: float
    target_pct: float
    history: list[float] = field(default_factory=list)  # oldest -> newest, weekly avg of included categories
    current_pct: float | None = None
    tier: str = "unknown"  # good | warn | crit | unknown
    cluster_count: int = 0


@dataclass
class ClusterStatus:
    cluster_id: str
    current_pct: float | None
    tier: str
    target_pct: float


@dataclass
class CategoryHealth:
    category: str
    avg_pct: float
    worst_pct: float
    tier: str
    target_pct: float


@dataclass
class TrendPoint:
    date: int  # epoch milliseconds, as returned by Grafana's dataframe response
    avg_pct: float


class SiteNotFoundError(LookupError):
    pass


def _tier_for(value: float | None, target: float) -> str:
    if value is None:
        return "unknown"
    if value >= target:
        return "good"
    if value >= WARN_FLOOR_PCT:
        return "warn"
    return "crit"


async def _fetch_site_rows() -> list[dict]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT code, display_name, country, latitude, longitude, cluster_prefix "
            "FROM sites WHERE enabled = 1 ORDER BY code"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def _fetch_site_by_code(code: str) -> dict:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT code, display_name, country, latitude, longitude, cluster_prefix "
            "FROM sites WHERE code = ? AND enabled = 1",
            (code,),
        )
        row = await cursor.fetchone()
        if row is None:
            raise SiteNotFoundError(code)
        return dict(row)


async def _fetch_all_category_settings() -> dict[str, dict[str, dict]]:
    """Every configured (site_code, category) row, keyed by site_code then
    category. Read fresh (uncached) — same reasoning as the site registry:
    this is admin-edited local data, and changes should show up on the next
    request rather than waiting out a Grafana result's TTL."""
    async with get_db() as db:
        cursor = await db.execute("SELECT site_code, category, target_pct, included FROM site_category_targets")
        rows = await cursor.fetchall()

    by_site: dict[str, dict[str, dict]] = {}
    for row in rows:
        by_site.setdefault(row["site_code"], {})[row["category"]] = dict(row)
    return by_site


def _category_setting(settings_by_site: dict, site_code: str, category: str) -> tuple[float, bool]:
    """(target_pct, included) for a site+category, defaulting to (99.0, included=True)
    for anything the admin hasn't explicitly configured."""
    row = settings_by_site.get(site_code, {}).get(category)
    if row is None:
        return TARGET_DEFAULT_PCT, True
    return row["target_pct"], bool(row["included"])


def _site_overall_target(settings_by_site: dict, site_code: str, known_categories: list[str]) -> float:
    """A site's overall target is the average of its included categories' own
    targets — the same averaging rule used for its current SLO value, so the
    two numbers stay comparable."""
    targets = []
    for category in known_categories:
        target, included = _category_setting(settings_by_site, site_code, category)
        if included:
            targets.append(target)
    return sum(targets) / len(targets) if targets else TARGET_DEFAULT_PCT


def _build_site_history(
    dates_for_site: dict[int, dict[str, tuple[float, int]]],
    settings_by_site: dict,
    site_code: str,
) -> list[float]:
    """A site's SLO at any given week is the average of its included
    categories' values that week (categories the admin excluded, or that
    simply didn't report that week, don't contribute).

    The most recent week is dropped if it reports far fewer rows than the
    week before — a sign that data for the current week is still trickling
    in rather than a real, complete result (as opposed to one category
    genuinely having a bad week, which should NOT be hidden)."""
    points: list[tuple[int, float, int]] = []  # (date, value, row_count)
    for date in sorted(dates_for_site):
        categories_that_day = dates_for_site[date]
        contributing = []
        row_count = 0
        for category, (avgslo, n) in categories_that_day.items():
            _target, included = _category_setting(settings_by_site, site_code, category)
            if included:
                contributing.append(avgslo)
                row_count += n
        if contributing:
            points.append((date, sum(contributing) / len(contributing), row_count))

    if len(points) >= 2 and points[-1][2] < points[-2][2] * 0.5:
        points = points[:-1]

    return [value for _, value, _ in points]


async def get_sites_overview(grafana: GrafanaClient, datasource_uid: str) -> CachedResult:
    """Join our SQLite site registry with live weekly SLO history from Grafana's `slo` table.

    The site registry and per-category settings (both edited via the admin
    panel) are read fresh on every call — they're local SQLite reads, not
    worth caching, and admin changes need to show up immediately rather than
    waiting out the Grafana result's TTL. Only the Grafana query is cached."""
    site_rows = await _fetch_site_rows()
    if not site_rows:
        return CachedResult(value=[], stale=False)
    settings_by_site = await _fetch_all_category_settings()

    async def fetch_grafana() -> tuple[list[dict], list[dict], list[dict]]:
        trend_rows = await grafana.query_sql(
            datasource_uid,
            f"""
            select LEFT(cluster_id, 3) as site, category, create_at, avg(min_slo) as avgslo, count(*) as n
            from slo
            where create_at >= current_date - interval '{HISTORY_WINDOW_DAYS} days'
            group by site, category, create_at
            order by site, create_at
            """,
        )
        cluster_count_rows = await grafana.query_sql(
            datasource_uid,
            "select LEFT(cluster_id, 3) as site, count(distinct cluster_id) as n from slo group by site",
        )
        category_rows = await grafana.query_sql(
            datasource_uid, "select distinct category from slo order by category"
        )
        return trend_rows, cluster_count_rows, category_rows

    grafana_result = await cached(f"grafana:sites-overview:{datasource_uid}", fetch_grafana)
    trend_rows, cluster_count_rows, category_rows = grafana_result.value
    known_categories = [row["category"] for row in category_rows]

    by_prefix: dict[str, dict[int, dict[str, tuple[float, int]]]] = {}
    for row in trend_rows:
        prefix = (row["site"] or "").lower()
        by_prefix.setdefault(prefix, {}).setdefault(row["create_at"], {})[row["category"]] = (
            row["avgslo"],
            row["n"],
        )

    cluster_count_by_prefix: dict[str, int] = {
        (row["site"] or "").lower(): int(row["n"]) for row in cluster_count_rows
    }

    statuses = []
    for site in site_rows:
        prefix = site["cluster_prefix"].lower()
        values = _build_site_history(by_prefix.get(prefix, {}), settings_by_site, site["code"])
        current = values[-1] if values else None
        target = _site_overall_target(settings_by_site, site["code"], known_categories)

        statuses.append(
            SiteStatus(
                code=site["code"],
                display_name=site["display_name"],
                country=site["country"],
                latitude=site["latitude"],
                longitude=site["longitude"],
                target_pct=target,
                history=values,
                current_pct=current,
                tier=_tier_for(current, target),
                cluster_count=cluster_count_by_prefix.get(prefix, 0),
            )
        )
    return CachedResult(value=statuses, stale=grafana_result.stale)


async def get_site_clusters(
    grafana: GrafanaClient, datasource_uid: str, site_code: str
) -> CachedResult:
    """Per-cluster SLO breakdown for a single site (its own registered `cluster_prefix`),
    compared against the site's own overall target (see _site_overall_target).

    The site lookup happens fresh (uncached) so a site that was just disabled or
    deleted in admin 404s immediately rather than staying visible until a Grafana
    cache entry expires; only the Grafana query result is cached."""
    site = await _fetch_site_by_code(site_code)
    prefix = safe_identifier(site["cluster_prefix"].lower())
    settings_by_site = await _fetch_all_category_settings()

    async def fetch_grafana() -> tuple[list[dict], list[dict]]:
        cluster_rows = await grafana.query_sql(
            datasource_uid,
            f"""
            select cluster_id, create_at, min(min_slo) as slo
            from slo
            where cluster_id like '{prefix}%'
            group by cluster_id, create_at
            order by cluster_id, create_at
            """,
        )
        category_rows = await grafana.query_sql(
            datasource_uid, "select distinct category from slo order by category"
        )
        return cluster_rows, category_rows

    grafana_result = await cached(f"grafana:site-clusters:{prefix}", fetch_grafana)
    cluster_rows, category_rows = grafana_result.value
    known_categories = [row["category"] for row in category_rows]
    target = _site_overall_target(settings_by_site, site["code"], known_categories)

    history_by_cluster: dict[str, list[float]] = {}
    for row in cluster_rows:
        history_by_cluster.setdefault(row["cluster_id"], []).append(row["slo"])

    clusters = []
    for cluster_id, points in sorted(history_by_cluster.items()):
        current = points[-1] if points else None
        clusters.append(
            ClusterStatus(
                cluster_id=cluster_id,
                current_pct=current,
                tier=_tier_for(current, target),
                target_pct=target,
            )
        )
    return CachedResult(value=clusters, stale=grafana_result.stale)


async def get_category_health(grafana: GrafanaClient, datasource_uid: str) -> CachedResult:
    """Global average/worst SLO per category, for the most recent date with real data.
    Not scoped to any one site, so there's no per-site target config to apply here —
    uses the flat default target."""

    async def fetch_grafana() -> list[dict]:
        return await grafana.query_sql(
            datasource_uid,
            """
            select category, avg(min_slo) as avgslo, min(min_slo) as worst
            from slo
            where create_at = (select max(create_at) from slo where min_slo > 0)
            group by category
            order by category
            """,
        )

    grafana_result = await cached(f"grafana:category-health:{datasource_uid}", fetch_grafana)
    categories = [
        CategoryHealth(
            category=row["category"],
            avg_pct=row["avgslo"],
            worst_pct=row["worst"],
            tier=_tier_for(row["avgslo"], TARGET_DEFAULT_PCT),
            target_pct=TARGET_DEFAULT_PCT,
        )
        for row in grafana_result.value
    ]
    return CachedResult(value=categories, stale=grafana_result.stale)


async def get_site_category_health(
    grafana: GrafanaClient, datasource_uid: str, site_code: str
) -> CachedResult:
    """Per-category SLO breakdown for a single site's own clusters, for the most
    recent date that site has real data — each category shown against its own
    configured target (see the admin panel's per-site category settings).
    Site lookup and settings are fresh (uncached); only the Grafana query
    result is cached — see get_site_clusters for why."""
    site = await _fetch_site_by_code(site_code)
    prefix = safe_identifier(site["cluster_prefix"].lower())
    settings_by_site = await _fetch_all_category_settings()

    async def fetch_grafana() -> list[dict]:
        return await grafana.query_sql(
            datasource_uid,
            f"""
            select category, avg(min_slo) as avgslo, min(min_slo) as worst
            from slo
            where cluster_id like '{prefix}%'
            and create_at = (
                select max(create_at) from slo
                where min_slo > 0 and cluster_id like '{prefix}%'
            )
            group by category
            order by category
            """,
        )

    grafana_result = await cached(f"grafana:site-category-health:{prefix}", fetch_grafana)
    categories = []
    for row in grafana_result.value:
        target, _included = _category_setting(settings_by_site, site["code"], row["category"])
        categories.append(
            CategoryHealth(
                category=row["category"],
                avg_pct=row["avgslo"],
                worst_pct=row["worst"],
                tier=_tier_for(row["avgslo"], target),
                target_pct=target,
            )
        )
    return CachedResult(value=categories, stale=grafana_result.stale)


async def get_global_trend(grafana: GrafanaClient, datasource_uid: str) -> list[TrendPoint]:
    """Weekly SLO average across every tracked cluster (not just our registered sites)."""
    rows = await grafana.query_sql(
        datasource_uid,
        f"""
        select create_at, avg(min_slo) as avg_slo
        from slo
        where create_at >= current_date - interval '{HISTORY_WINDOW_DAYS} days'
        group by create_at
        order by create_at
        """,
    )
    points = [TrendPoint(date=row["create_at"], avg_pct=row["avg_slo"]) for row in rows]

    # same partial-current-week artifact as the per-site history
    if len(points) >= 2 and points[-1].avg_pct == 0 and points[-2].avg_pct > 0:
        points = points[:-1]
    return points


async def get_cluster_count(grafana: GrafanaClient, datasource_uid: str) -> int:
    """Total number of distinct clusters reporting into the `slo` table."""
    rows = await grafana.query_sql(datasource_uid, "select count(distinct cluster_id) as n from slo")
    return int(rows[0]["n"]) if rows else 0


async def list_known_categories(grafana: GrafanaClient, datasource_uid: str) -> CachedResult:
    """Every category name actually reporting into the `slo` table — used by the
    admin panel so per-site category targets can be entered against a real
    category name instead of guessed blind."""

    async def fetch_grafana() -> list[dict]:
        return await grafana.query_sql(datasource_uid, "select distinct category from slo order by category")

    grafana_result = await cached(f"grafana:known-categories:{datasource_uid}", fetch_grafana)
    return CachedResult(value=[row["category"] for row in grafana_result.value], stale=grafana_result.stale)
