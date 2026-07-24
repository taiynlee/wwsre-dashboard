from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.grafana_client import GrafanaClient
from app.routers.public import router as public_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    app.state.grafana_client = GrafanaClient()
    yield
    await app.state.grafana_client.aclose()


app = FastAPI(title="WWSRE Dashboard — Public API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(public_router)
