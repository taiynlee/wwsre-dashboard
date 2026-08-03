# Builds one image that serves the public dashboard at / and the admin
# panel at /admin, both backends behind an internal nginx. See
# deploy/README.md for the build/push/deploy commands and deploy/certs/
# for the optional internal CA trust setup.

FROM node:20-alpine AS public-frontend-build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
WORKDIR /src
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# Same-origin in production (nginx proxies /api/public/* on this container's
# own port) — an empty base URL makes axios use relative paths.
ENV VITE_PUBLIC_API_BASE_URL=""
RUN npm run build

FROM node:20-alpine AS admin-frontend-build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
WORKDIR /src
COPY admin-frontend/package*.json ./
RUN npm ci
COPY admin-frontend/ .
ENV VITE_ADMIN_API_BASE_URL=""
RUN npm run build -- --base=/admin/

FROM python:3.11-slim AS backend-deps
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.11-slim
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Trust an internally-issued CA for every outbound HTTPS connection this
# container makes, if one was supplied (deploy/certs/README.md) — a no-op
# if the directory has no .crt in it.
COPY deploy/certs/ /usr/local/share/ca-certificates/extra/
RUN find /usr/local/share/ca-certificates/extra/ -name '*.crt' -exec cp {} /usr/local/share/ca-certificates/ \; \
    && update-ca-certificates

WORKDIR /app/backend
COPY --from=backend-deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
COPY backend/app ./app
COPY backend/pyproject.toml ./
# Baked in rather than injected/mounted at runtime (deliberate choice —
# see .dockerignore's matching comment). pydantic-settings reads .env
# automatically via Settings.model_config's env_file=".env", relative to
# this WORKDIR, which matches entrypoint.sh's `cd /app/backend`. Carries
# both the Grafana connection info and the app's own Postgres registry DB
# credentials (PG_*) — the site list itself now lives in that Postgres
# instance, not in this image (see README's 資料模型 section).
COPY backend/.env ./.env

COPY --from=public-frontend-build /src/dist /var/www/public
COPY --from=admin-frontend-build /src/dist /var/www/admin

COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/public/health || exit 1

CMD ["/entrypoint.sh"]
