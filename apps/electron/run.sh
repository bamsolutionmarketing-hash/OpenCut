#!/usr/bin/env bash
# One-command launcher for OpenCut Desktop (dev mode).
# Usage:  ./apps/electron/run.sh
#         OPENCUT_PORT=4001 ./apps/electron/run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

exec bun run dev
