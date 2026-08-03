# Deploying

One image serves everything: the public dashboard at `/`, the admin panel
at `/admin`, and both backend APIs behind an internal nginx on port 8080.

## Before building

1. **Runtime config** — `backend/.env` is copied **into the image** at build
   time (see the Dockerfile's `COPY backend/.env ./.env`), so `Settings`
   picks it up with zero required env vars at runtime — no k8s Secret,
   no `--env-file`. This is a deliberate tradeoff, not an oversight: it
   means the image is self-contained and dead simple to run, but the image
   **now contains real secrets** (`GRAFANA_BASE_URL`,
   `GRAFANA_POSTGRES_DATASOURCE_UID`, etc. — see `backend/app/config.py`
   for the full list) in its layers. Anyone who can `docker pull` this
   image from Harbor can read them back out (`docker save` + inspect the
   layer, or just `docker run --entrypoint sh ... cat backend/.env`). Only
   acceptable because Harbor access here is itself already
   internal/controlled — if that stops being true, switch back to
   `envFrom: secretRef` + removing the `COPY backend/.env` line instead.
   Make sure the real `backend/.env` exists locally (copy
   `backend/.env.example` and fill it in) before running `docker build` —
   the build fails otherwise.
2. **Internal CA cert** (optional) — see `deploy/certs/README.md`.
3. **Site data** — the `sites` table starts empty; add sites through the
   admin panel at `/admin` after deploying (or run `python -m app.seed`
   inside the running container if you've mounted a real
   `site_registry.seed.json`).

## Access control on /admin

There is currently **no auth in front of `/admin`** — it's wide open to
anyone who can reach the container on port 8080. This is fine for the
current testing phase but needs a real answer before this goes anywhere
production-facing: restrict `/admin` at the ingress/network-policy layer
(internal-only ingress rule, IP allowlist, VPN-only route), or add an auth
layer in front of it. Don't expose this port to the public internet as-is.

## Build

```sh
docker build -t <your-registry>/<your-project>/wwsre-dashboard:<tag> .
```

## Push

```sh
docker push <your-registry>/<your-project>/wwsre-dashboard:<tag>
```

## Run locally

```sh
docker run --rm -p 8080:8080 <your-registry>/<your-project>/wwsre-dashboard:<tag>
```

No `--env-file` needed — the image already has `backend/.env` baked in (see
above). Then: dashboard at `http://localhost:8080/`, admin at
`http://localhost:8080/admin`.
