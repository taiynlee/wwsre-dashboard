#!/bin/sh
set -e

# Both backends run as separate processes behind the same nginx entrypoint —
# this keeps the two-port-in-dev structure of the codebase intact while
# packaging as one deployable image/port. Not a process supervisor: if a
# backend process dies, this script doesn't restart it or fail the
# container — acceptable for the current single-image testing deployment,
# revisit (e.g. split into two Deployments behind one Ingress) if that
# matters later.
cd /app/backend

# SQLite isn't on a mounted volume in this deployment, so it's just a fresh
# empty file inside the container each start — reseed from the baked-in
# site list every time. Idempotent (ON CONFLICT DO NOTHING, keyed by
# code — see app/seed.py), so this is a no-op once a real persistent
# volume/admin edits have taken over.
python -m app.seed

uvicorn app.main_public:app --host 127.0.0.1 --port 8000 &
uvicorn app.main_admin:app --host 127.0.0.1 --port 8001 &

exec nginx -g 'daemon off;'
