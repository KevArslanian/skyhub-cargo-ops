#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/media/about/sky-clouds.mp4"
OUT_MP4="$ROOT/public/media/about/sky-clouds-lite.mp4"
OUT_WEBM="$ROOT/public/media/about/sky-clouds-lite.webm"

if [[ ! -f "$SRC" ]]; then
  echo "Missing source: $SRC" >&2
  exit 1
fi

ffmpeg -y -i "$SRC" -an \
  -vf "scale=640:-2" -r 24 \
  -c:v libx264 -crf 28 -preset slow -g 12 -keyint_min 12 \
  -movflags +faststart \
  "$OUT_MP4"

ffmpeg -y -i "$SRC" -an \
  -vf "scale=640:-2" -r 24 \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -g 12 -keyint_min 12 \
  "$OUT_WEBM"

ls -lh "$OUT_MP4" "$OUT_WEBM"
echo "encode-about-scrub-video: ok"