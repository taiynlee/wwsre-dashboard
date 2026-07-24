import pytest

from app.db import init_db
from app.schemas import SiteCreate, SiteUpdate
from app.services import site_admin_service


def _payload(**overrides) -> SiteCreate:
    base = dict(
        code="AAA",
        display_name="Test City",
        country="Test Country",
        latitude=1.0,
        longitude=2.0,
        cluster_prefix="aaa",
        enabled=True,
    )
    base.update(overrides)
    return SiteCreate(**base)


async def test_create_and_get_site():
    await init_db()

    created = await site_admin_service.create_site(_payload())

    assert created["code"] == "AAA"
    assert created["enabled"] is True
    fetched = await site_admin_service.get_site("AAA")
    assert fetched == created


async def test_create_duplicate_code_raises():
    await init_db()
    await site_admin_service.create_site(_payload())

    with pytest.raises(site_admin_service.SiteAlreadyExistsError):
        await site_admin_service.create_site(_payload())


async def test_create_rejects_unsafe_cluster_prefix():
    await init_db()

    with pytest.raises(ValueError):
        await site_admin_service.create_site(_payload(cluster_prefix="aaa'; drop table slo; --"))


async def test_update_site_partial_fields_only():
    await init_db()
    await site_admin_service.create_site(_payload())

    updated = await site_admin_service.update_site("AAA", SiteUpdate(enabled=False))

    assert updated["enabled"] is False
    assert updated["display_name"] == "Test City"  # untouched


async def test_update_unknown_site_raises():
    await init_db()

    with pytest.raises(site_admin_service.SiteNotFoundError):
        await site_admin_service.update_site("NOPE", SiteUpdate(enabled=False))


async def test_update_rejects_unsafe_cluster_prefix():
    await init_db()
    await site_admin_service.create_site(_payload())

    with pytest.raises(ValueError):
        await site_admin_service.update_site("AAA", SiteUpdate(cluster_prefix="bad prefix!"))


async def test_delete_site_removes_it():
    await init_db()
    await site_admin_service.create_site(_payload())

    await site_admin_service.delete_site("AAA")

    with pytest.raises(site_admin_service.SiteNotFoundError):
        await site_admin_service.get_site("AAA")


async def test_delete_unknown_site_raises():
    await init_db()

    with pytest.raises(site_admin_service.SiteNotFoundError):
        await site_admin_service.delete_site("NOPE")


async def test_list_sites_includes_disabled_by_default():
    await init_db()
    await site_admin_service.create_site(_payload(enabled=False))

    result = await site_admin_service.list_sites()

    assert len(result) == 1
    assert result[0]["enabled"] is False


async def test_list_sites_can_exclude_disabled():
    await init_db()
    await site_admin_service.create_site(_payload(code="AAA", cluster_prefix="aaa", enabled=True))
    await site_admin_service.create_site(_payload(code="BBB", cluster_prefix="bbb", enabled=False))

    result = await site_admin_service.list_sites(include_disabled=False)

    assert [s["code"] for s in result] == ["AAA"]
