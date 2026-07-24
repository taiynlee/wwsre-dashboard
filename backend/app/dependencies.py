from fastapi import Request

from app.config import Settings, get_settings
from app.grafana_client import GrafanaClient


async def get_grafana_client(request: Request) -> GrafanaClient:
    return request.app.state.grafana_client


def get_app_settings() -> Settings:
    return get_settings()
