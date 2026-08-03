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

    # Own registry DB (sites + per-site category targets) — a separate,
    # dedicated Postgres instance, not the Grafana one above (see README's
    # 架構 section). We own this one and write to it (site CRUD, admin
    # category-target edits); the Grafana Postgres stays read-only, queried
    # only via GrafanaClient's /api/ds/query proxy.
    pg_host: str
    pg_port: int = 5432
    pg_user: str
    pg_password: str
    pg_database: str
    pg_schema: str = "dashboard"

    public_api_port: int = 8000
    admin_api_port: int = 8001


@lru_cache
def get_settings() -> Settings:
    return Settings()
