from fastapi import APIRouter, Depends, HTTPException, Response

from app.cache import cached
from app.config import Settings
from app.dependencies import get_app_settings, get_grafana_client
from app.grafana_client import GrafanaClient
from app.services import live_service, slo_service

router = APIRouter(prefix="/api/public", tags=["public"])


def _mark_staleness(response: Response, stale: bool) -> None:
    response.headers["X-Stale-Data"] = "true" if stale else "false"


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/sites")
async def list_sites(
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[slo_service.SiteStatus]:
    result = await slo_service.get_sites_overview(grafana, settings.grafana_postgres_datasource_uid)
    _mark_staleness(response, result.stale)
    return result.value


@router.get("/sites/{code}/clusters")
async def list_site_clusters(
    code: str,
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[slo_service.ClusterStatus]:
    try:
        result = await slo_service.get_site_clusters(grafana, settings.grafana_postgres_datasource_uid, code)
    except slo_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown site code: {code}")
    _mark_staleness(response, result.stale)
    return result.value


@router.get("/sites/{code}/categories")
async def list_site_categories(
    code: str,
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[slo_service.CategoryHealth]:
    try:
        result = await slo_service.get_site_category_health(grafana, settings.grafana_postgres_datasource_uid, code)
    except slo_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown site code: {code}")
    _mark_staleness(response, result.stale)
    return result.value


@router.get("/categories")
async def list_categories(
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[slo_service.CategoryHealth]:
    result = await slo_service.get_category_health(grafana, settings.grafana_postgres_datasource_uid)
    _mark_staleness(response, result.stale)
    return result.value


@router.get("/trend")
async def get_trend(
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[slo_service.TrendPoint]:
    result = await cached(
        "public:trend",
        lambda: slo_service.get_global_trend(grafana, settings.grafana_postgres_datasource_uid),
    )
    _mark_staleness(response, result.stale)
    return result.value


@router.get("/clusters/count")
async def get_cluster_count(
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    result = await cached(
        "public:clusters:count",
        lambda: slo_service.get_cluster_count(grafana, settings.grafana_postgres_datasource_uid),
    )
    _mark_staleness(response, result.stale)
    return {"count": result.value}


@router.get("/clusters/{cluster_id}/categories")
async def list_cluster_categories(
    cluster_id: str,
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> list[slo_service.CategoryHealth]:
    try:
        result = await slo_service.get_cluster_category_health(
            grafana, settings.grafana_postgres_datasource_uid, cluster_id
        )
    except slo_service.SiteNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown cluster id: {cluster_id}")
    _mark_staleness(response, result.stale)
    return result.value


@router.get("/clusters/{cluster_id}/live")
async def get_cluster_live(
    cluster_id: str,
    response: Response,
    grafana: GrafanaClient = Depends(get_grafana_client),
    settings: Settings = Depends(get_app_settings),
) -> live_service.LiveClusterMetrics:
    try:
        result = await cached(
            f"public:clusters:{cluster_id}:live",
            lambda: live_service.get_cluster_live(
                grafana,
                prometheus_uid=settings.grafana_prometheus_datasource_uid,
                postgres_uid=settings.grafana_postgres_datasource_uid,
                cluster_id=cluster_id,
                local_cluster_id=settings.local_cluster_id,
            ),
        )
    except ValueError:
        raise HTTPException(status_code=400, detail=f"invalid cluster id: {cluster_id}")
    _mark_staleness(response, result.stale)
    return result.value
