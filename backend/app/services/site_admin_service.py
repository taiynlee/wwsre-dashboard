from app.db import get_db, utcnow_iso
from app.schemas import SiteCreate, SiteUpdate
from app.sql_safety import is_identifier_shaped


class SiteAlreadyExistsError(ValueError):
    pass


class SiteNotFoundError(LookupError):
    pass


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["enabled"] = bool(d["enabled"])
    return d


async def list_sites(*, include_disabled: bool = True) -> list[dict]:
    query = "SELECT * FROM sites"
    if not include_disabled:
        query += " WHERE enabled = 1"
    query += " ORDER BY code"
    async with get_db() as db:
        cursor = await db.execute(query)
        rows = await cursor.fetchall()
        return [_row_to_dict(r) for r in rows]


async def get_site(code: str) -> dict:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM sites WHERE code = ?", (code,))
        row = await cursor.fetchone()
        if row is None:
            raise SiteNotFoundError(code)
        return _row_to_dict(row)


async def create_site(payload: SiteCreate) -> dict:
    if not is_identifier_shaped(payload.code):
        raise ValueError(f"code must be letters/digits/hyphens only: {payload.code!r}")
    if not is_identifier_shaped(payload.cluster_prefix):
        raise ValueError(f"cluster_prefix must be letters/digits/hyphens only: {payload.cluster_prefix!r}")

    now = utcnow_iso()
    async with get_db() as db:
        cursor = await db.execute("SELECT 1 FROM sites WHERE code = ?", (payload.code,))
        if await cursor.fetchone() is not None:
            raise SiteAlreadyExistsError(payload.code)

        await db.execute(
            """
            INSERT INTO sites (code, display_name, country, latitude, longitude, cluster_prefix, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.code,
                payload.display_name,
                payload.country,
                payload.latitude,
                payload.longitude,
                payload.cluster_prefix.lower(),
                1 if payload.enabled else 0,
                now,
                now,
            ),
        )
        await db.commit()

    return await get_site(payload.code)


async def update_site(code: str, payload: SiteUpdate) -> dict:
    updates = payload.model_dump(exclude_unset=True)
    if "cluster_prefix" in updates:
        if not is_identifier_shaped(updates["cluster_prefix"]):
            raise ValueError(
                f"cluster_prefix must be letters/digits/hyphens only: {updates['cluster_prefix']!r}"
            )
        updates["cluster_prefix"] = updates["cluster_prefix"].lower()
    if "enabled" in updates:
        updates["enabled"] = 1 if updates["enabled"] else 0

    await get_site(code)  # raises SiteNotFoundError if missing

    if not updates:
        return await get_site(code)

    updates["updated_at"] = utcnow_iso()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    async with get_db() as db:
        await db.execute(
            f"UPDATE sites SET {set_clause} WHERE code = ?",
            (*updates.values(), code),
        )
        await db.commit()

    return await get_site(code)


async def delete_site(code: str) -> None:
    await get_site(code)  # raises SiteNotFoundError if missing
    async with get_db() as db:
        await db.execute("DELETE FROM site_category_targets WHERE site_code = ?", (code,))
        await db.execute("DELETE FROM sites WHERE code = ?", (code,))
        await db.commit()
