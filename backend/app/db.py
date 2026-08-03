import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import asyncpg

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sites (
    code            TEXT PRIMARY KEY,
    display_name    TEXT NOT NULL,
    country         TEXT NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    cluster_prefix  TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

-- Per-site, per-category SLO configuration. A site's overall SLO is the
-- average of its `included` categories' current values; its overall target
-- is the average of those same categories' target_pct. Categories with no
-- row here fall back to the default target (99.0%) and count as included.
CREATE TABLE IF NOT EXISTS site_category_targets (
    site_code   TEXT NOT NULL REFERENCES sites(code),
    category    TEXT NOT NULL,
    target_pct  DOUBLE PRECISION NOT NULL DEFAULT 99.0,
    included    BOOLEAN NOT NULL DEFAULT true,
    updated_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (site_code, category)
);
"""

_pool: asyncpg.Pool | None = None
# Which event loop _pool's connections belong to — asyncpg pools are
# loop-affine, so this is how _get_pool()/close_db() detect a pool left
# over from a *different* loop (only happens under pytest-asyncio, which
# gives each test its own loop; a real running app has exactly one loop
# for its whole process lifetime) and rebuild instead of reusing/closing
# it, which would otherwise crash cross-loop.
_pool_loop: asyncio.AbstractEventLoop | None = None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_pool() -> asyncpg.Pool:
    global _pool, _pool_loop
    current_loop = asyncio.get_running_loop()
    if _pool is not None and _pool_loop is not current_loop:
        _pool = None
    if _pool is None:
        settings = get_settings()
        # search_path applies per-connection, so it's set for every
        # connection the pool ever opens (not just the one that happens to
        # run init_db()) — every later unqualified `sites`/
        # `site_category_targets` reference resolves against pg_schema
        # without any query needing to spell out the schema itself.
        _pool = await asyncpg.create_pool(
            host=settings.pg_host,
            port=settings.pg_port,
            user=settings.pg_user,
            password=settings.pg_password,
            database=settings.pg_database,
            server_settings={"search_path": settings.pg_schema},
            min_size=1,
            max_size=5,
        )
        _pool_loop = current_loop
    return _pool


async def init_db() -> None:
    settings = get_settings()
    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Schema creation doesn't depend on search_path, so this is safe to
        # run even on a connection whose search_path points at a schema
        # that doesn't exist yet (Postgres just resolves later unqualified
        # names against it once this returns).
        await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{settings.pg_schema}"')
        await conn.execute(SCHEMA)


async def close_db() -> None:
    global _pool, _pool_loop
    if _pool is None:
        return
    if _pool_loop is asyncio.get_running_loop():
        await _pool.close()
    # else: pool belongs to a different (likely already-gone) loop — can't
    # safely await closing it from here, so just drop the reference.
    _pool = None
    _pool_loop = None


@asynccontextmanager
async def get_db():
    pool = await _get_pool()
    async with pool.acquire() as conn:
        yield conn
