#!/usr/bin/env bash
# One-command launcher for OpenCut Desktop (dev mode).
# Usage:  ./apps/electron/run.sh
#         OPENCUT_PORT=4001 ./apps/electron/run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "ERROR: bun is not installed or not on PATH." >&2
  echo "" >&2
  echo "This repo requires bun (it is the locked package manager)." >&2
  echo "Install it with:" >&2
  echo "    curl -fsSL https://bun.sh/install | bash" >&2
  echo "Then restart your shell so PATH picks it up." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "→ installing apps/electron deps …"
  bun install
fi

if [ ! -f node_modules/electron/dist/electron ]; then
  echo "→ downloading Electron binary …"
  node node_modules/electron/install.js
fi

if [ ! -d "$SCRIPT_DIR/../web/node_modules" ]; then
  echo "→ installing apps/web deps (parent workspace) …"
  (cd "$SCRIPT_DIR/../.." && bun install)
fi

# Bootstrap .env.local from .env.example so Next env validation passes.
WEB_ENV_LOCAL="$SCRIPT_DIR/../web/.env.local"
WEB_ENV_EXAMPLE="$SCRIPT_DIR/../web/.env.example"
if [ ! -f "$WEB_ENV_LOCAL" ] && [ -f "$WEB_ENV_EXAMPLE" ]; then
  echo "→ creating apps/web/.env.local from .env.example (placeholder values)"
  cp "$WEB_ENV_EXAMPLE" "$WEB_ENV_LOCAL"
fi

exec bun run dev
