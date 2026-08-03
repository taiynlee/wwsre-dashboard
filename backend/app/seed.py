"""Seed the sites table from a local, gitignored JSON file.

The real site list (names, coordinates) is confidential, so it never lives in
tracked source — only in `site_registry.seed.json`, which is gitignored.
`site_registry.seed.example.json` documents the expected shape with fake data.

Run with: uv run python -m app.seed
Safe to re-run — existing rows (matched by `code`) are left untouched.
"""

import asyncio
import json
from pathlib import Path

from app.db import get_db, init_db, utcnow

SEED_FILE = Path(__file__).resolve().parent.parent / "site_registry.seed.json"
EXAMPLE_FILE = SEED_FILE.with_name("site_registry.seed.example.json")


def load_sites() -> list[dict]:
    if not SEED_FILE.exists():
        raise FileNotFoundError(
            f"{SEED_FILE} not found. Copy {EXAMPLE_FILE.name} to "
            f"{SEED_FILE.name} and fill in the real site list (it's gitignored)."
        )
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


async def seed() -> None:
    await init_db()
    now = utcnow()
    async with get_db() as conn:
        async with conn.transaction():
            for site in load_sites():
                await conn.execute(
                    """
                    INSERT INTO sites (code, display_name, country, latitude, longitude, cluster_prefix, enabled, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
                    ON CONFLICT (code) DO NOTHING
                    """,
                    site["code"],
                    site["display_name"],
                    site["country"],
                    site["latitude"],
                    site["longitude"],
                    site["cluster_prefix"],
                    now,
                    now,
                )


if __name__ == "__main__":
    asyncio.run(seed())
