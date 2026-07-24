from app.db import init_db
from app.schemas import SiteCategoryTargetIn
from app.services import slo_target_service
from tests.helpers import FakeGrafanaClient, insert_site


async def test_get_site_category_settings_defaults_to_99_and_included():
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(sql_rows=[{"category": "K8S-Node"}, {"category": "K8S-ArgoCD"}])

    result = await slo_target_service.get_site_category_settings(grafana, "test-uid", "AAA")

    by_category = {c["category"]: c for c in result.value}
    assert by_category["K8S-Node"]["target_pct"] == 99.0
    assert by_category["K8S-Node"]["included"] is True
    assert by_category["K8S-ArgoCD"]["target_pct"] == 99.0
    assert by_category["K8S-ArgoCD"]["included"] is True


async def test_get_site_category_settings_merges_stored_overrides():
    await init_db()
    await insert_site("AAA", "aaa")
    grafana = FakeGrafanaClient(sql_rows=[{"category": "K8S-Node"}, {"category": "K8S-ArgoCD"}])
    await slo_target_service.replace_site_category_settings(
        "AAA",
        [
            SiteCategoryTargetIn(category="K8S-Node", target_pct=95.0, included=True),
            SiteCategoryTargetIn(category="K8S-ArgoCD", target_pct=99.0, included=False),
        ],
    )

    result = await slo_target_service.get_site_category_settings(grafana, "test-uid", "AAA")

    by_category = {c["category"]: c for c in result.value}
    assert by_category["K8S-Node"]["target_pct"] == 95.0
    assert by_category["K8S-ArgoCD"]["included"] is False


async def test_replace_site_category_settings_discards_previous_set():
    await init_db()
    await insert_site("AAA", "aaa")
    await slo_target_service.replace_site_category_settings(
        "AAA", [SiteCategoryTargetIn(category="K8S-Node", target_pct=95.0, included=True)]
    )

    result = await slo_target_service.replace_site_category_settings(
        "AAA", [SiteCategoryTargetIn(category="K8S-ETCD", target_pct=90.0, included=False)]
    )

    assert len(result) == 1
    assert result[0]["category"] == "K8S-ETCD"

    stored = await slo_target_service._fetch_site_category_rows("AAA")
    assert "K8S-Node" not in stored
    assert stored["K8S-ETCD"]["target_pct"] == 90.0


async def test_settings_are_scoped_per_site():
    await init_db()
    await insert_site("AAA", "aaa")
    await insert_site("BBB", "bbb")
    await slo_target_service.replace_site_category_settings(
        "AAA", [SiteCategoryTargetIn(category="K8S-Node", target_pct=90.0, included=True)]
    )

    all_settings = await slo_target_service.fetch_all_site_category_settings()

    assert "AAA" in all_settings
    assert "BBB" not in all_settings
