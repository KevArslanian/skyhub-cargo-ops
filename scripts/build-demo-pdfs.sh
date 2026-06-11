#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/docs/demo-pdf"
TEMPLATE="$OUT_DIR/templates/demo-sheet.typ"

cd "$ROOT"

pnpm demo:export

if ! command -v typst >/dev/null 2>&1; then
  echo "typst tidak ditemukan. Jalankan: bash ~/.grok/skills/pdf/scripts/setup.sh" >&2
  exit 1
fi

compile_pdf() {
  local json_name="$1"
  local pdf_name="$2"
  typst compile "$OUT_DIR/templates/demo-sheet.typ" "$OUT_DIR/$pdf_name" \
    --root "$OUT_DIR" \
    --input "data=../$json_name"
  echo "Built $OUT_DIR/$pdf_name"
}

compile_pdf "kredensial.json" "skyhub-demo-kredensial.pdf"
compile_pdf "daftar-awb.json" "skyhub-demo-daftar-awb.pdf"
compile_pdf "daftar-penerbangan.json" "skyhub-demo-daftar-penerbangan.pdf"

echo "Selesai: 3 PDF demo di $OUT_DIR"