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

uvicorn app.main_public:app --host 127.0.0.1 --port 8000 &
uvicorn app.main_admin:app --host 127.0.0.1 --port 8001 &

exec nginx -g 'daemon off;'
