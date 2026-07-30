from app.db import init_db
from app.services.slo_service import get_sites_overview
from tests.helpers import FakeGrafanaClient, insert_site


async def test_returns_empty_when_no_sites_registered():
    await init_db()
    grafana = FakeGrafanaClient(sql_rows=[])

    result = (await get_sites_overview(grafana, datasource_uid="test-uid")).value

    assert result == []
    assert grafana.sql_calls == []  # no point querying Grafana with nothing to join against


async def test_joins_history_and_computes_tier():
    await init_db()
    await insert_site("AAA", "aaa")
    await insert_site("BBB", "bbb")
    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
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
            [
                {"site": "aaa", "n": 3},
                {"site": "bbb", "n": 5},
            ],
            [{"category": "K8S-Node"}],
        ]
    )

    result = (await get_sites_overview(grafana, datasource_uid="test-uid")).value

    by_code = {s.code: s for s in result}
    assert by_code["AAA"].current_pct == 99.8
    assert by_code["AAA"].tier == "good"
    assert by_code["AAA"].cluster_count == 3
    assert by_code["BBB"].current_pct == 54.3
    assert by_code["BBB"].tier == "crit"
    assert by_code["BBB"].cluster_count == 5
    assert grafana.sql_calls[0][0] == "test-uid"


async def test_site_with_no_matching_grafana_rows_is_unknown():
    await init_db()
    await insert_site("CCC", "ccc")
    grafana = FakeGrafanaClient(sql_rows=[])

    result = (await get_sites_overview(grafana, datasource_uid="test-uid")).value

    assert result[0].current_pct is None
    assert result[0].tier == "unknown"
    assert result[0].history == []


async def test_trailing_week_with_few_rows_is_treated_as_still_accumulating():
    """A week reporting far fewer rows than the week before it looks like data
    still trickling in — dropped so 'current' reflects the last complete week."""
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
            [
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-01", "avgslo": 99.5, "n": 14},
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-08", "avgslo": 99.8, "n": 14},
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-15", "avgslo": 50.0, "n": 2},
            ],
            [
                {"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-01", "slo": 99.5},
                {"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-08", "slo": 99.8},
            ],
            [{"site": "aaa", "n": 1}],
            [{"category": "K8S-Node"}],
        ]
    )

    result = (await get_sites_overview(grafana, datasource_uid="test-uid")).value

    # current_pct comes from the separate per-cluster query, not from
    # `history` — this test is really about the trailing-week heuristic
    # below, so current_pct here is just whatever the per-cluster mock's
    # latest row says.
    assert result[0].current_pct == 99.8
    assert result[0].history == [99.5, 99.8]


async def test_a_genuinely_bad_week_is_not_hidden_just_because_the_value_is_low():
    """Regression guard: a real category outage must still show up in
    `history` as long as that week reported a normal number of rows — only
    row COUNT (not the value itself) should decide whether a week looks
    incomplete. (`current_pct` itself comes from the separate per-cluster
    query below, unfiltered — see get_sites_overview's docstring — so it
    reflects a bad day unconditionally; this test's real subject is
    `history`.)"""
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(
        sql_rows_sequence=[
            [
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-01", "avgslo": 99.5, "n": 14},
                {"site": "aaa", "category": "K8S-Node", "create_at": "2026-06-08", "avgslo": 0.0, "n": 14},
            ],
            [
                {"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-01", "slo": 99.5},
                {"cluster_id": "aaa-01", "site": "aaa", "create_at": "2026-06-08", "slo": 0.0},
            ],
            [{"site": "aaa", "n": 1}],
            [{"category": "K8S-Node"}],
        ]
    )

    result = (await get_sites_overview(grafana, datasource_uid="test-uid")).value

    assert result[0].history == [99.5, 0.0]
    assert result[0].current_pct == 0.0
    assert result[0].tier == "crit"
