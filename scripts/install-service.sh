#!/usr/bin/env bash
# Runs StoryCast in the background on Linux (systemd user service): it starts when you log in, restarts if it
# crashes, and is always at http://localhost:3001 without keeping a terminal open.
# Run it again after pulling new code: it rebuilds the app and restarts the service.
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
NODE="$(command -v node)"
UNIT_DIR="$HOME/.config/systemd/user"

npm run build

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/storycast.service" <<UNIT
[Unit]
Description=StoryCast AI (Next.js production server)
After=network-online.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$NODE $APP_DIR/node_modules/.bin/next start -p 3001
Environment=NODE_ENV=production
Environment=PATH=$(dirname "$NODE"):/usr/local/bin:/usr/bin:/bin
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable storycast >/dev/null
systemctl --user restart storycast
echo "StoryCast đang chạy nền tại http://localhost:3001"
