# WWSRE Dashboard — Implementation Plan

Checklist form of the roadmap in [README.md](README.md). Check items off as they're completed. See README for architecture/rationale — this file is just the tracked task list.

## Phase 1 — Foundations

- [x] `backend/`: `uv init`, add deps (fastapi, uvicorn[standard], httpx, cachetools, pydantic-settings, sqlite deps, pytest)
- [x] `backend/app/config.py` — `pydantic-settings` Settings (`GRAFANA_BASE_URL`, datasource uid, `CACHE_TTL_SECONDS`, `PUBLIC_PORT`, `ADMIN_PORT`, SQLite path), `.env.example`
- [x] `backend/app/db.py` — SQLite connection + schema init (`sites`, `site_category_targets`)
- [x] `backend/app/seed.py` — seed script reading the site list (code/city/country/lat/long/cluster_id prefix) from gitignored `backend/site_registry.seed.json` (confidential — real data never committed; see `site_registry.seed.example.json` for the shape)
- [x] `backend/app/main_public.py` + `backend/app/main_admin.py` — two FastAPI app entrypoints, health-check route each, runnable on ports 8000/8001 (note: port 8000 collides with an unrelated local service on this machine — confirm the real port before deploying)
- [x] `backend/tests/` — scaffold + a passing health-check test
- [x] `frontend/`: Vite + React + TS scaffold, TanStack Router (file-based), Tailwind, Axios, lucide-react installed and wired, one placeholder route rendering
- [x] `admin-frontend/`: separate minimal Vite + React + TS scaffold (no router needed yet, just renders)

## Phase 2 — Backend read-only data layer

- [x] `app/grafana_client.py` — `httpx.AsyncClient` wrapping `POST /api/ds/query` (SQL) and Prometheus proxy queries
- [x] `app/cache.py` — `cachetools.TTLCache` wrapper keyed by query string
- [x] `app/services/slo_service.py` — joins SQLite site registry with live Grafana `slo`/`slo_target` data
- [x] Unit tests for `slo_service` using a mocked `GrafanaClient` (no live network calls in tests)

## Phase 3 — Public API (port 8000)

- [x] `GET /api/public/sites`
- [x] `GET /api/public/sites/{code}/clusters`
- [x] `GET /api/public/categories`
- [x] `GET /api/public/trend`
- [x] `GET /api/public/clusters/{id}/live`

## Phase 4 — Admin API (port 8001)

- [x] `GET /api/admin/sites`
- [x] `POST /api/admin/sites`
- [x] `PATCH /api/admin/sites/{code}`
- [x] `DELETE /api/admin/sites/{code}`
- [x] `GET/PUT /api/admin/sites/{code}/categories` — per-site per-category SLO target + included flag (superseded the original global site/category-nullable override table after a real correctness bug was found: see README's "為什麼「目前 SLO」是分類平均" note)

## Phase 5 — Public dashboard UI

- [x] `/` Overview route: world map + KPI row + "sites to watch" ranking + category health rings + trend chart + site card grid (per approved mockup)
- [x] Swap placeholder hand-drawn continents for real topojson — used `d3-geo` + `topojson-client` + `world-atlas` directly instead of `react-simple-maps`, which doesn't declare React 19 support yet (peer range still 16–18 as of the latest beta); same underlying libraries, no wrapper, no version conflict
- [x] `/sites/$code` detail route: cluster list, category breakdown (new `GET /api/public/sites/{code}/categories` endpoint added to support this), external Grafana link
- [x] Axios + TanStack Query wiring (60s staleTime/refetchInterval against backend TTL cache)

## Phase 6 — Admin panel UI

- [x] Card-based site list (view)
- [x] Add-site card/form
- [x] Edit-in-place or form per site (city/country/lat/long/cluster prefix/enabled)
- [x] Per-site SLO category editor — 9 real categories (fetched from Grafana), each with an editable target% and an "included in this site's average" checkbox
- [x] Delete confirmation
- [x] No-auth (removed the warning banner per explicit request — access control is now a deployment-layer concern, see Phase 8)

## Phase 7 — Hardening

- [x] Grafana-unreachable fallback: `cache.py` tracks a separate "last known good" value per key and serves it with `X-Stale-Data: true` when a fresh fetch fails, instead of the request failing outright
- [x] Loading/empty states (no sites registered, no clusters for a site, secondary panels loading/erroring independently of the main sites query)
- [x] Responsive + keyboard accessibility + `prefers-reduced-motion` pass — world map pins are real keyboard-operable controls (`role="button"`, `tabIndex`, `aria-label`, arrow-key-free Enter/Space activation), global `:focus-visible` ring, all animations gated on `motion-safe:`
- [x] Backend service-layer unit tests (38 total, incl. cache stale-fallback + a full router-level HTTP round trip); frontend key-component render tests via Vitest + React Testing Library (9 tests in `frontend/`, 4 in `admin-frontend/`)
- [x] Fixed a real correctness bug found via live use: a site's headline "current SLO" could silently hide a genuine per-category outage because the old trailing-week heuristic keyed off "is the value exactly 0" instead of "did this week actually report enough rows" — see README

## Phase 8 — Deployment

- [x] Single Docker image: public frontend at `/`, admin frontend at `/admin`, both FastAPI backends behind an internal nginx on one exposed port
- [x] `.dockerignore` keeps `.env` / other local-only confidential files out of the image; site data lives in a dedicated Postgres instead of being baked into the image
- [x] Optional internal CA trust (`deploy/certs/`, gitignored)
- [x] Registry DB migrated from SQLite to a dedicated Postgres instance (`asyncpg`, connection pool + `search_path` in `app/db.py`) — real local site data (10 sites, 9 category-target overrides) migrated over with zero loss; admin-panel edits now survive pod restarts/redeploys without a mounted volume
- [x] Built and smoke-tested end to end (`/`, `/admin`, both `/api/*/health`) against a real registry push
- [ ] `/admin` access control at the ingress/network-policy layer — explicitly deferred for the current testing phase, not yet decided

## Open items to resolve along the way

- [ ] Decide what to do about `geo.SLO` staleness (ignore vs investigate the job that writes it)
- [ ] Confirm "Abnormal – no impact" vs "Abnormal – impact" threshold (current placeholder: ≥target normal, 95–target no-impact, <95 impact)
- [ ] Decide `/admin` access control before any real (non-testing) deployment
