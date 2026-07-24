import pytest

from app.cache import cached


async def test_fresh_fetch_is_not_stale():
    result = await cached("k1", lambda: _ok("first"))

    assert result.value == "first"
    assert result.stale is False


async def test_cache_hit_skips_fetch():
    calls = []

    async def fetch():
        calls.append(1)
        return "value"

    await cached("k2", fetch)
    result = await cached("k2", fetch)

    assert result.value == "value"
    assert result.stale is False
    assert len(calls) == 1  # second call was served from cache, fetch not called again


async def test_falls_back_to_last_good_value_on_fetch_failure():
    from app import cache as cache_module

    await cached("k3", lambda: _ok("good-value"))
    # simulate the TTL entry expiring (a fresh fetch would normally run) while
    # keeping the separate "last known good" record intact
    del cache_module._cache["k3"]

    result = await cached("k3", _boom)

    assert result.value == "good-value"
    assert result.stale is True


async def test_raises_when_no_last_good_value_exists():
    with pytest.raises(RuntimeError):
        await cached("k4", _boom)


async def _ok(value: str) -> str:
    return value


async def _boom() -> str:
    raise RuntimeError("grafana unreachable")
