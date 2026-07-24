import re

# Grafana's `/api/ds/query` proxy takes a raw SQL string with no bind-parameter
# support, so any value we interpolate into a query has to be validated first —
# this is the trust boundary against SQL injection for cluster_id / site prefixes.
_IDENTIFIER_RE = re.compile(r"^[a-z0-9-]+$")


def safe_identifier(value: str) -> str:
    """Validate a cluster_id / cluster_prefix-shaped string before it's interpolated
    into a Grafana rawSql query. Raises ValueError if it contains anything other than
    lowercase letters, digits, and hyphens."""
    if not value or not _IDENTIFIER_RE.match(value):
        raise ValueError(f"invalid identifier for SQL interpolation: {value!r}")
    return value


def is_identifier_shaped(value: str) -> bool:
    """Same character rule as `safe_identifier`, case-insensitive and non-raising —
    for validating admin-entered `code`/`cluster_prefix` at write time, before it
    ever has a chance to reach `safe_identifier` on the read path."""
    return bool(value) and bool(_IDENTIFIER_RE.match(value.lower()))
