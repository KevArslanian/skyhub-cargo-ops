#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/skyhub-dev-3100.log"
PORT=3100

pkill -f "${ROOT}.*next dev" 2>/dev/null || true
lsof -ti :"${PORT}" | xargs kill -9 2>/dev/null || true
sleep 1

cd "$ROOT"
export PORT
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

nohup pnpm dev --hostname 127.0.0.1 >>"$LOG" 2>&1 &
echo $! > /tmp/skyhub-dev-3100.pid
disown || true

for _ in $(seq 1 30); do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:${PORT}/login"; then
    echo "READY http://127.0.0.1:${PORT} pid=$(cat /tmp/skyhub-dev-3100.pid)"
    exit 0
  fi
  sleep 1
done

echo "FAILED — see $LOG"
tail -20 "$LOG"
exit 1