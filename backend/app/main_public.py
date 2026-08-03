from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_db, init_db
from app.grafana_client import GrafanaClient
from app.routers.public import router as public_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # close_db() before init_db() is a no-op in normal single-process
    # startup (there's no pool yet) — it matters for tests, where
    # TestClient runs this lifespan in its own thread/event loop, and an
    # asyncpg pool from a different loop (e.g. one a pytest-asyncio fixture
    # already opened) can't be reused there.
    await close_db()
    await init_db()
    app.state.grafana_client = GrafanaClient()
    yield
    await app.state.grafana_client.aclose()
    await close_db()


app = FastAPI(title="WWSRE Dashboard — Public API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # A regex instead of a fixed origin — Vite falls back to the next free
    # port (5174, 5175, ...) whenever 5173 is already taken by something
    # else on the machine, which would otherwise make CORS fail in a way
    # that looks like the backend is unreachable.
    allow_origin_regex=r"http://localhost:517\d",
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(public_router)
