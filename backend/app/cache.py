from dataclasses import dataclass
from typing import Any, Awaitable, Callable, TypeVar

from cachetools import TTLCache

from app.config import get_settings

T = TypeVar("T")

_cache: TTLCache | None = None
_last_good: dict[str, Any] = {}


def _get_cache() -> TTLCache:
    global _cache
    if _cache is None:
        settings = get_settings()
        _cache = TTLCache(maxsize=512, ttl=settings.cache_ttl_seconds)
    return _cache


@dataclass
class CachedResult:
    value: Any
    stale: bool


async def cached(key: str, fetch: Callable[[], Awaitable[T]]) -> CachedResult:
    """Return the cached value for `key`, calling `fetch()` on a miss.

    If `fetch()` fails (e.g. Grafana is unreachable) and a previously successful
    value exists for this key, that stale value is returned instead of failing
    the request outright — callers should surface `stale=True` to the client
    rather than silently pretending the data is current.
    """
    cache = _get_cache()
    if key in cache:
        return CachedResult(value=cache[key], stale=False)

    try:
        value = await fetch()
    except Exception:
        if key in _last_good:
            return CachedResult(value=_last_good[key], stale=True)
        raise

    cache[key] = value
    _last_good[key] = value
    return CachedResult(value=value, stale=False)


def clear_cache() -> None:
    """Test-only escape hatch — also useful if a manual refresh endpoint is added later."""
    global _cache
    _cache = None
    _last_good.clear()
