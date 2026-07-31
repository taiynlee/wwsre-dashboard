from app.db import init_db
from app.services.checker_service import run_checks
from tests.helpers import FakeGrafanaClient, insert_site


async def test_run_checks_flags_a_breaching_site_but_not_a_healthy_one():
    await init_db()
    await insert_site("AAA", "aaa")
    await insert_site("BBB", "bbb")

    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
            # get_sites_overview: trend_rows, cluster_current_rows, cluster_count_rows, category_rows
            [
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-01", "avgslo": 99.5, "n": 2},
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-08", "avgslo": 99.8, "n": 2},
                {"site": "bbb", "category": "K8S-Node", "create_at": "2026-06-01", "avgslo": 99.3, "n": 2},
                {"site": "bbb", "category": "K8S-Node", "create_at": "2026-06-08", "avgslo": 54.3, "n": 2},
            ],
            [
                {"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-01", "slo": 99.5},
                {"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-08", "slo": 99.8},
                {"cluster_id": "bbb-01", "site": "bbb", "create_at": "2026-06-01", "slo": 99.3},
                {"cluster_id": "bbb-01", "site": "bbb", "create_at": "2026-06-08", "slo": 54.3},
            ],
            [{"site": "aaa", "n": 1}, {"site": "bbb", "n": 1}],
            [{"category": "K8S-Node"}],
            # list_known_categories
            [{"category": "K8S-Node"}],
            # get_site_clusters("BBB"): cluster_rows, category_rows
            [
                {"cluster_id": "bbb-01", "create_at": "2026-06-01", "slo": 99.3},
                {"cluster_id": "bbb-01", "create_at": "2026-06-08", "slo": 54.3},
            ],
            [{"category": "K8S-Node"}],
            # get_cluster_category_health("bbb-01")
            [{"category": "K8S-Node", "avgslo": 54.3, "worst": 54.3}],
            # grafana_mapping gap check: mapped cluster_ids, then all reporting cluster_ids
            [{"cluster_id": "aaa-01"}],
            [{"cluster_id": "aaa-01"}, {"cluster_id": "bbb-01"}],
        ]
    )

    findings = await run_checks(grafana, "test-uid")

    site_codes = {f.site_code for f in findings}
    assert "AAA" not in site_codes  # healthy site produces nothing
    assert "BBB" in site_codes

    by_category = {}
    for f in findings:
        by_category.setdefault(f.category, []).append(f)

    # bbb-01 is BBB's only cluster, so "fixing" it projects the site all the
    # way to 100 (nothing else left to be the new minimum) — the site-level
    # and cluster-level findings carry that identical uplift, so both get
    # superseded by the category finding that's actually the root cause
    # (dedup collapses the whole cascade down to one line).
    assert "breach" not in by_category
    assert by_category["category_issue"][0].cluster_id == "bbb-01"
    assert by_category["category_issue"][0].message.startswith("bbb-01")
    assert by_category["category_issue"][0].potential_uplift_pct == 45.7

    mapping_findings = by_category["grafana_mapping"]
    assert len(mapping_findings) == 1
    assert mapping_findings[0].cluster_id == "bbb-01"  # aaa-01 has a mapping row, bbb-01 doesn't


async def test_run_checks_only_credits_uplift_to_the_actually_binding_cluster():
    """A site can have more than one breaching cluster — only the worst one
    is what's actually holding the site's current_pct down, so fixing a
    less-bad (but still breaching) cluster shouldn't claim any uplift."""
    await init_db()
    await insert_site("DDD", "ddd")

    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
            [{"site": "ddd", "category": "K8S-Node", "create_at": "2026-06-01", "avgslo": 80.0, "n": 2}],
            [
                {"cluster_id": "ddd-01", "site": "ddd", "create_at": "2026-06-01", "slo": 60.0},
                {"cluster_id": "ddd-02", "site": "ddd", "create_at": "2026-06-01", "slo": 97.0},
            ],
            [{"site": "ddd", "n": 2}],
            [{"category": "K8S-Node"}],
            [{"category": "K8S-Node"}],  # list_known_categories
            [
                {"cluster_id": "ddd-01", "create_at": "2026-06-01", "slo": 60.0},
                {"cluster_id": "ddd-02", "create_at": "2026-06-01", "slo": 97.0},
            ],
            [{"category": "K8S-Node"}],
            [{"category": "K8S-Node", "avgslo": 60.0, "worst": 60.0}],  # ddd-01 categories
            [{"category": "K8S-Node", "avgslo": 97.0, "worst": 97.0}],  # ddd-02 categories
            [{"cluster_id": "ddd-01"}, {"cluster_id": "ddd-02"}],  # grafana_mapping — both mapped
            [{"cluster_id": "ddd-01"}, {"cluster_id": "ddd-02"}],
        ]
    )

    findings = await run_checks(grafana, "test-uid")

    # ddd-01's breach finding is superseded by its own category finding
    # (same uplift, more specific — see the dedup test above); ddd-02's
    # uplift is 0, so there's nothing for its category finding to supersede
    # and the cluster-level finding survives.
    by_cluster_category = {f.cluster_id: f for f in findings if f.category == "category_issue"}
    assert by_cluster_category["ddd-01"].potential_uplift_pct == 37.0  # the real binding constraint

    by_cluster_breach = {f.cluster_id: f for f in findings if f.category == "breach" and f.cluster_id}
    assert "ddd-01" not in by_cluster_breach
    assert by_cluster_breach["ddd-02"].potential_uplift_pct == 0.0  # still breaching, but not what's holding site back


async def test_run_checks_flags_a_site_with_zero_clusters():
    await init_db()
    await insert_site("CCC", "ccc")

    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
            [],  # trend_rows
            [],  # cluster_current_rows
            [],  # cluster_count_rows -> cluster_count defaults to 0
            [],  # category_rows
            [],  # list_known_categories
            [],  # grafana_mapping
            [],  # reporting clusters
        ]
    )

    findings = await run_checks(grafana, "test-uid")

    assert len(findings) == 1
    assert findings[0].category == "no_data"
    assert findings[0].site_code == "CCC"
    assert findings[0].severity == "crit"
