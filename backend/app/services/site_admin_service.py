from datetime import datetime

from app.db import get_db, utcnow
from app.schemas import SiteCreate, SiteUpdate
from app.sql_safety import is_identifier_shaped


class SiteAlreadyExistsError(ValueError):
    pass


class SiteNotFoundError(LookupError):
    pass


def _row_to_dict(row) -> dict:
    d = dict(row)
    # created_at/updated_at come back as real datetimes from Postgres —
    # convert to the ISO string SiteOut still declares, so the API
    # contract/schema didn't need to change for this migration.
    for key in ("created_at", "updated_at"):
        if isinstance(d.get(key), datetime):
            d[key] = d[key].isoformat()
    return d


async def list_sites(*, include_disabled: bool = True) -> list[dict]:
    query = "SELECT * FROM sites"
    if not include_disabled:
        query += " WHERE enabled = true"
    query += " ORDER BY code"
    async with get_db() as conn:
        rows = await conn.fetch(query)
        return [_row_to_dict(r) for r in rows]


async def get_site(code: str) -> dict:
    async with get_db() as conn:
        row = await conn.fetchrow("SELECT * FROM sites WHERE code = $1", code)
        if row is None:
            raise SiteNotFoundError(code)
        return _row_to_dict(row)


async def create_site(payload: SiteCreate) -> dict:
    if not is_identifier_shaped(payload.code):
        raise ValueError(f"code must be letters/digits/hyphens only: {payload.code!r}")
    if not is_identifier_shaped(payload.cluster_prefix):
        raise ValueError(f"cluster_prefix must be letters/digits/hyphens only: {payload.cluster_prefix!r}")

    now = utcnow()
    async with get_db() as conn:
        exists = await conn.fetchval("SELECT 1 FROM sites WHERE code = $1", payload.code)
        if exists is not None:
            raise SiteAlreadyExistsError(payload.code)

        await conn.execute(
            """
            INSERT INTO sites (code, display_name, country, latitude, longitude, cluster_prefix, enabled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            payload.code,
            payload.display_name,
            payload.country,
            payload.latitude,
            payload.longitude,
            payload.cluster_prefix.lower(),
            payload.enabled,
            now,
            now,
        )

    return await get_site(payload.code)


async def update_site(code: str, payload: SiteUpdate) -> dict:
    updates = payload.model_dump(exclude_unset=True)
    if "cluster_prefix" in updates:
        if not is_identifier_shaped(updates["cluster_prefix"]):
            raise ValueError(
                f"cluster_prefix must be letters/digits/hyphens only: {updates['cluster_prefix']!r}"
            )
        updates["cluster_prefix"] = updates["cluster_prefix"].lower()

    await get_site(code)  # raises SiteNotFoundError if missing

    if not updates:
        return await get_site(code)

    updates["updated_at"] = utcnow()
    columns = list(updates.keys())
    set_clause = ", ".join(f"{col} = ${i + 1}" for i, col in enumerate(columns))
    values = [updates[col] for col in columns]
    async with get_db() as conn:
        await conn.execute(
            f"UPDATE sites SET {set_clause} WHERE code = ${len(columns) + 1}",
            *values,
            code,
        )

    return await get_site(code)


async def delete_site(code: str) -> None:
    await get_site(code)  # raises SiteNotFoundError if missing
    async with get_db() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM site_category_targets WHERE site_code = $1", code)
            await conn.execute("DELETE FROM sites WHERE code = $1", code)
