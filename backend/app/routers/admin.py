from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_app_settings, get_grafana_client
from app.config import Settings
from app.grafana_client import GrafanaClient
from app.schemas import SiteCategoryTargetIn, SiteCategoryTargetOut, SiteCreate, SiteOut, SiteUpdate
from app.services import site_admin_service, slo_target_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/sites")
async def list_sites() -> list[SiteOut]:
    return await site_admin_service.list_sites()


@router.post("/sites", status_code=201)
async def create_site(payload: SiteCreate) -> SiteOut:
    try:
        return await site_admin_service.create_site(payload)
    except site_admin_service.SiteAlreadyExistsError:
        raise HTTPException(status_code=409, detail=f"site already exists: {payload.code}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.patch("/sites/{code}")
async def update_site(code: str, payload: SiteUpdate) -> SiteOut:
    try:
        return await site_admin_service.update_site(code, payload)
    except site_admin_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown site code: {code}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.delete("/sites/{code}", status_code=204)
async def delete_site(code: str) -> None:
    try:
        await site_admin_service.delete_site(code)
    except site_admin_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown site code: {code}")


@router.get("/sites/{code}/categories")
async def get_site_categories(
    code: str,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[SiteCategoryTargetOut]:
    try:
        await site_admin_service.get_site(code)
    except site_admin_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown site code: {code}")
    result = await slo_target_service.get_site_category_settings(
        grafana, settings.grafana_postgres_datasource_uid, code
    )
    return result.value


@router.put("/sites/{code}/categories")
async def replace_site_categories(code: str, payload: list[SiteCategoryTargetIn]) -> list[SiteCategoryTargetOut]:
    try:
        await site_admin_service.get_site(code)
    except site_admin_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown site code: {code}")
    return await slo_target_service.replace_site_category_settings(code, payload)
