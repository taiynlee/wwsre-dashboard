from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.grafana_client import GrafanaClient
from app.routers.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Admin is otherwise SQLite-only (CRUD on the local registry) — the one
    # exception is reading known category names from Grafana, purely so the
    # SLO target override form can suggest real values instead of blind text entry.
    app.state.grafana_client = GrafanaClient()
    yield
    await app.state.grafana_client.aclose()


app = FastAPI(title="WWSRE Dashboard — Admin API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
    allow_headers=["*"],
)

app.include_router(admin_router)
