# Internal CA certificate

If your deployment needs this container to trust an internally-issued CA
(e.g. so outbound HTTPS calls verify correctly), drop the certificate here
as `internal-ca.crt` (PEM format) before running `docker build`. It's
gitignored — this directory only ever holds it locally / in your build
context, never in the repo.

The Dockerfile copies whatever's in this directory into the image's system
CA trust store via `update-ca-certificates`. If `internal-ca.crt` isn't
present, that step is skipped and the build still succeeds — the container
just won't trust anything beyond the base image's default CA bundle.
