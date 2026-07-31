from dataclasses import dataclass

from app.grafana_client import GrafanaClient
from app.services import slo_service

SCAN_INTERVAL_SECONDS = 300


@dataclass
class Finding:
    severity: str  # "warn" | "crit"
    category: str  # "no_data" | "breach" | "category_issue" | "grafana_mapping"
    message: str
    site_code: str | None = None
    cluster_id: str | None = None
    # How much the site's headline current_pct (worst cluster's latest day —
    # see get_sites_overview) would rise if this specific thing were fixed.
    # 0.0 wherever that's not a knowable number (no data to project from,
    # or the thing doesn't feed into that figure at all — e.g. a missing
    # Grafana link).
    potential_uplift_pct: float = 0.0


def _projected_site_pct(cluster_values: list[float], excluding_cluster_id: str, cluster_ids: list[str]) -> float:
    """What the site's current_pct would become if `excluding_cluster_id`
    were pulled out of the picture (fixed) — the min of everyone else's
    value, or 100.0 if it was the site's only cluster. Comparing this
    against the *actual current* site.current_pct (not against this
    cluster's own value) is what makes the result come out to ~0 for a
    cluster that wasn't actually the binding constraint: some other,
    still-bad cluster remains the real minimum either way."""
    remaining = [v for v, cid in zip(cluster_values, cluster_ids) if cid != excluding_cluster_id]
    return min(remaining) if remaining else 100.0


def _dedupe_cascades(findings: list[Finding]) -> list[Finding]:
    """A single root cause typically produces a finding at every level —
    site, cluster, category — all carrying the identical potential_uplift_pct
    because they're describing the same number moving (see
    _projected_site_pct). Rather than list the same problem three times,
    keep only the most specific finding in each such chain."""
    cluster_uplifts = {
        (f.site_code, f.cluster_id, f.potential_uplift_pct)
        for f in findings
        if f.category == "breach" and f.cluster_id is not None and f.potential_uplift_pct > 0
    }
    category_uplifts = {
        (f.site_code, f.cluster_id, f.potential_uplift_pct)
        for f in findings
        if f.category == "category_issue" and f.potential_uplift_pct > 0
    }

    result = []
    for f in findings:
        if f.category == "breach" and f.potential_uplift_pct > 0:
            if f.cluster_id is None:
                # site-level: superseded by whichever cluster carries the same uplift
                if any(site == f.site_code and up == f.potential_uplift_pct for site, _cid, up in cluster_uplifts):
                    continue
            elif (f.site_code, f.cluster_id, f.potential_uplift_pct) in category_uplifts:
                # cluster-level: superseded by a category finding within it
                continue
        result.append(f)
    return result


async def run_checks(grafana: GrafanaClient, datasource_uid: str) -> list[Finding]:
    """One full pass over every registered site, looking for things an admin
    would want to know about. Read-only — this only ever queries Grafana and
    the local site registry, never writes anything. Findings aren't
    persisted; each scan replaces the previous result in the caller's
    in-memory state (see main_admin.py's background loop)."""
    findings: list[Finding] = []

    sites = (await slo_service.get_sites_overview(grafana, datasource_uid)).value
    known_categories = set((await slo_service.list_known_categories(grafana, datasource_uid)).value)

    for site in sites:
        if site.cluster_count == 0:
            findings.append(
                Finding(
                    severity="crit",
                    category="no_data",
                    message=f"{site.code} 沒有任何 cluster 回報資料——確認 cluster_prefix 設定是否正確",
                    site_code=site.code,
                )
            )
            continue

        if site.current_pct is None:
            findings.append(
                Finding(
                    severity="warn",
                    category="no_data",
                    message=f"{site.code} 有 {site.cluster_count} 個 cluster,但目前抓不到任何 SLO 數值",
                    site_code=site.code,
                )
            )
            continue

        if site.tier not in ("warn", "crit"):
            continue

        clusters = (await slo_service.get_site_clusters(grafana, datasource_uid, site.code)).value
        reporting = [c for c in clusters if c.current_pct is not None]
        cluster_ids = [c.cluster_id for c in reporting]
        cluster_values = [c.current_pct for c in reporting]  # type: ignore[misc]

        worst_cluster_id = min(reporting, key=lambda c: c.current_pct).cluster_id if reporting else None
        site_uplift = (
            round(max(0.0, _projected_site_pct(cluster_values, worst_cluster_id, cluster_ids) - site.current_pct), 1)
            if worst_cluster_id
            else 0.0
        )
        findings.append(
            Finding(
                severity=site.tier,
                category="breach",
                message=f"{site.code} 目前 {site.current_pct:.1f}%,低於 target {site.target_pct:.1f}%",
                site_code=site.code,
                potential_uplift_pct=site_uplift,
            )
        )

        for cluster in clusters:
            if cluster.tier not in ("warn", "crit"):
                continue

            value_text = f"{cluster.current_pct:.1f}%" if cluster.current_pct is not None else "沒有資料"
            cluster_uplift = round(
                max(0.0, _projected_site_pct(cluster_values, cluster.cluster_id, cluster_ids) - site.current_pct), 1
            )
            findings.append(
                Finding(
                    severity=cluster.tier,
                    category="breach",
                    message=f"{site.code} 的 cluster {cluster.cluster_id} 目前 {value_text}",
                    site_code=site.code,
                    cluster_id=cluster.cluster_id,
                    potential_uplift_pct=cluster_uplift,
                )
            )

            categories = (await slo_service.get_cluster_category_health(grafana, datasource_uid, cluster.cluster_id)).value
            reported = {c.category for c in categories}
            for cat in categories:
                if cat.tier in ("warn", "crit"):
                    findings.append(
                        Finding(
                            severity=cat.tier,
                            category="category_issue",
                            message=f"{cluster.cluster_id} 的 {cat.category} 只有 {cat.avg_pct:.1f}%(target {cat.target_pct:.1f}%)",
                            site_code=site.code,
                            cluster_id=cluster.cluster_id,
                            # Best case (fixing this category fully unblocks the
                            # cluster) — same ceiling as fixing the cluster outright.
                            potential_uplift_pct=cluster_uplift,
                        )
                    )
            for missing in sorted(known_categories - reported):
                findings.append(
                    Finding(
                        severity="warn",
                        category="category_issue",
                        message=f"{cluster.cluster_id} 缺少 {missing} 的資料(該分類完全沒有回報)",
                        site_code=site.code,
                        cluster_id=cluster.cluster_id,
                        # No reported value to project a fix from.
                        potential_uplift_pct=0.0,
                    )
                )

    # Clusters reporting real SLO data but with no grafana_mapping row have no
    # working "Open in Grafana" link on their card (see live_service's
    # _lookup_external_url) — silently degraded rather than an outright
    # error, so it's easy to miss without a scan looking for it. Doesn't
    # move any SLO number, so potential_uplift_pct stays 0.0.
    mapped = {
        row["cluster_id"]
        for row in await grafana.query_sql(datasource_uid, "select distinct cluster_id from grafana_mapping")
    }
    reporting_clusters = await grafana.query_sql(datasource_uid, "select distinct cluster_id from slo")
    for row in reporting_clusters:
        cluster_id = row["cluster_id"]
        if cluster_id not in mapped:
            findings.append(
                Finding(
                    severity="warn",
                    category="grafana_mapping",
                    message=f"cluster {cluster_id} 有回報 SLO 資料,但 grafana_mapping 裡沒有對應網址,卡片上會顯示「no link on record」",
                    cluster_id=cluster_id,
                )
            )

    return _dedupe_cascades(findings)
