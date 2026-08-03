import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_db, init_db
from app.grafana_client import GrafanaClient
from app.routers.admin import router as admin_router
from app.services import checker_service

logger = logging.getLogger(__name__)


async def _checker_loop(app: FastAPI) -> None:
    """Background scan for things an admin would want to know about — no
    data source, target breaches, missing Grafana links. Findings live only
    in app.state (see checker_service.run_checks's docstring for why): each
    pass replaces the previous result, nothing is persisted or dismissible.
    Runs once immediately on startup, then every SCAN_INTERVAL_SECONDS."""
    settings = get_settings()
    while True:
        try:
            findings = await checker_service.run_checks(
                app.state.grafana_client, settings.grafana_postgres_datasource_uid
            )
            app.state.checker_findings = findings
            app.state.checker_last_run = datetime.now(timezone.utc).isoformat()
        except Exception:
            logger.exception("checker scan failed")
        await asyncio.sleep(checker_service.SCAN_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # close_db() before init_db() is a no-op in normal single-process
    # startup — it matters for tests, where TestClient runs this lifespan
    # in its own thread/event loop, and an asyncpg pool from a different
    # loop can't be reused there.
    await close_db()
    await init_db()
    # Admin otherwise only touches its own Postgres registry (site CRUD,
    # category-target edits) — the one exception is reading known category
    # names from Grafana, purely so the SLO target override form can
    # suggest real values instead of blind text entry.
    app.state.grafana_client = GrafanaClient()
    app.state.checker_findings = []
    app.state.checker_last_run = None
    checker_task = asyncio.create_task(_checker_loop(app))
    yield
    checker_task.cancel()
    await app.state.grafana_client.aclose()
    await close_db()


app = FastAPI(title="WWSRE Dashboard — Admin API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # See main_public.py's identical comment — Vite's auto-fallback port
    # range, not just the one default port.
    allow_origin_regex=r"http://localhost:517\d",
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
    allow_headers=["*"],
)

app.include_router(admin_router)
