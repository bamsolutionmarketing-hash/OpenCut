#!/usr/bin/env bash
# Installs a ~/.local/share/applications/opencut.desktop entry so
# OpenCut Desktop (dev mode) shows up in your application launcher.
#
# Usage: ./apps/electron/install-desktop-entry.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SH="$SCRIPT_DIR/run.sh"
TARGET_DIR="$HOME/.local/share/applications"
TARGET_FILE="$TARGET_DIR/opencut.desktop"

mkdir -p "$TARGET_DIR"

cat > "$TARGET_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=OpenCut
Comment=OpenCut video editor with CN→VI auto-pipeline
Exec=bash -c "$RUN_SH"
Icon=video-x-generic
Terminal=false
Categories=AudioVideo;Video;
StartupWMClass=OpenCut
EOF

chmod +x "$TARGET_FILE" 2>/dev/null || true

echo "Installed: $TARGET_FILE"
echo "→ Launch \"OpenCut\" from your application menu, or run: $RUN_SH"
