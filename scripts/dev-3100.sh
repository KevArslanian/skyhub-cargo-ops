#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
export PORT=3100
echo "Starting SkyHub dev server on http://localhost:${PORT}"
exec pnpm dev