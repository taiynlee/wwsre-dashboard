from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    grafana_base_url: str
    grafana_postgres_datasource_uid: str
    grafana_prometheus_datasource_uid: str

    # cluster_id whose live Prometheus SLI this Grafana instance can actually reach —
    # every other cluster only gets an external link via grafana_mapping. Confidential
    # (reveals real infra naming), so it lives only in .env, never a tracked default.
    local_cluster_id: str = ""

    cache_ttl_seconds: int = 90

    sqlite_path: str = "./data/wwsre.db"

    public_api_port: int = 8000
    admin_api_port: int = 8001


@lru_cache
def get_settings() -> Settings:
    return Settings()
