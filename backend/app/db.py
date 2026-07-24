import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import aiosqlite

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sites (
    code            TEXT PRIMARY KEY,
    display_name    TEXT NOT NULL,
    country         TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    cluster_prefix  TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

DROP TABLE IF EXISTS slo_target_overrides;

-- Per-site, per-category SLO configuration. A site's overall SLO is the
-- average of its `included` categories' current values; its overall target
-- is the average of those same categories' target_pct. Categories with no
-- row here fall back to the default target (99.0%) and count as included.
CREATE TABLE IF NOT EXISTS site_category_targets (
    site_code   TEXT NOT NULL REFERENCES sites(code),
    category    TEXT NOT NULL,
    target_pct  REAL NOT NULL DEFAULT 99.0,
    included    INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (site_code, category)
);
"""


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db() -> None:
    settings = get_settings()
    os.makedirs(os.path.dirname(settings.sqlite_path) or ".", exist_ok=True)
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await db.executescript(SCHEMA)
        await db.commit()


@asynccontextmanager
async def get_db():
    settings = get_settings()
    db = await aiosqlite.connect(settings.sqlite_path)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()
