#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Vaidix — render runtime config files from .tpl templates
# ════════════════════════════════════════════════════════════════════════════
# Some service config files (egress.yaml) need secrets that the upstream
# binaries don't read from env vars (verified). For those we keep a `.tpl`
# version in git with `${VAR}` placeholders, gitignore the rendered file,
# and run this script to substitute env values at deploy time.
#
# Usage (run from repo root):
#   ./scripts/render-configs.sh
#
# Run before `docker compose up` (the egress service mounts ./egress.yaml).
# Re-running overwrites the rendered file — safe and idempotent.
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Resolve repo root regardless of where the script is called from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v envsubst >/dev/null 2>&1; then
  echo "[render-configs] envsubst not found. Install with: sudo apt-get install -y gettext-base" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "[render-configs] .env not found at $REPO_ROOT/.env" >&2
  exit 1
fi

# Load .env so envsubst can see the variables. Use `set -a` so all assignments
# become exports automatically, regardless of whether .env quotes them.
set -a
# shellcheck disable=SC1091
. .env
set +a

# List of (template, output) pairs. Add more here as needed.
RENDERED=()
render() {
  local src="$1" out="$2"
  if [ ! -f "$src" ]; then
    echo "[render-configs] template missing: $src" >&2
    exit 1
  fi
  envsubst < "$src" > "$out"
  # 644 not 600: bind-mounted into containers running as non-root uids
  # (e.g. egress runs as its own user). 600 owned by host user blocks reads
  # from inside the container. The host directory should be access-controlled.
  chmod 644 "$out"
  RENDERED+=("$out")
}

render egress.yaml.tpl egress.yaml

echo "[render-configs] rendered:"
printf '  %s\n' "${RENDERED[@]}"
