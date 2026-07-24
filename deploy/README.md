# Deploying

One image serves everything: the public dashboard at `/`, the admin panel
at `/admin`, and both backend APIs behind an internal nginx on port 8080.

## Before building

1. **Runtime config** — the image ships with no `.env` baked in (secrets
   belong in a k8s Secret at runtime, not in an image layer anyone with
   registry pull access can read). Copy `backend/.env.example` to see what's
   required and supply the real values via `envFrom: secretRef` in your
   Deployment — see `backend/app/config.py` for the full list
   (`GRAFANA_BASE_URL`, `GRAFANA_POSTGRES_DATASOURCE_UID`, etc.).
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
docker run --rm -p 8080:8080 --env-file backend/.env <your-registry>/<your-project>/wwsre-dashboard:<tag>
```

Then: dashboard at `http://localhost:8080/`, admin at
`http://localhost:8080/admin`.
