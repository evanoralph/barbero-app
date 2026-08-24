#!/usr/bin/env bash
# Export App Store Connect 6.5" Display screenshots from a Maestro capture folder.
#
# App Store Connect accepts (portrait):
#   1284 x 2778  (preferred — this script's default)
#   1242 x 2688
#
# Usage:
#   scripts/screenshots/export-app-store-6.5.sh --from ~/Documents/barbero-app-screenshots/<timestamp>
#   scripts/screenshots/export-app-store-6.5.sh --from <dir> --out <dir>
#   scripts/screenshots/export-app-store-6.5.sh --from <dir> --size 1242x2688
#
# Requires: sips (macOS built-in).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FROM_DIR=""
OUT_DIR=""
TARGET_W=1284
TARGET_H=2778

# Default curated shortlist for App Store Connect (first 3 appear on install sheets).
DEFAULT_SOURCES=(
  "customer__01_home.png"
  "customer__02_explore.png"
  "customer__03_provider_profile.png"
  "customer__04_book_flow.png"
  "customer__13_map.png"
)

usage() {
  sed -n '2,14p' "$0"
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM_DIR="$2"; shift ;;
    --out) OUT_DIR="$2"; shift ;;
    --size)
      # Accept WIDTHxHEIGHT (e.g. 1284x2778 or 1242x2688)
      TARGET_W="${2%%x*}"
      TARGET_H="${2##*x}"
      shift
      ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

if [ -z "$FROM_DIR" ]; then
  echo "Missing --from <capture-dir>" >&2
  usage
fi
if [ ! -d "$FROM_DIR" ]; then
  echo "[export-6.5] ERROR: capture dir not found: $FROM_DIR" >&2
  exit 1
fi

FROM_DIR="$(cd "$FROM_DIR" && pwd)"
if [ -z "$OUT_DIR" ]; then
  OUT_DIR="$FROM_DIR/iphone-6.5"
fi
mkdir -p "$OUT_DIR"

echo "[export-6.5] source=$FROM_DIR"
echo "[export-6.5] output=$OUT_DIR"
echo "[export-6.5] target=${TARGET_W}x${TARGET_H}"

exported=0
missing=0
i=0
for src_name in "${DEFAULT_SOURCES[@]}"; do
  i=$((i + 1))
  src="$FROM_DIR/$src_name"
  # Strip flow prefix (customer__/provider__/auth__) and any leading NN_ from Maestro names.
  base="${src_name#customer__}"
  base="${base#provider__}"
  base="${base#auth__}"
  base="$(echo "$base" | sed -E 's/^[0-9]+_//')"
  # 01_, 02_, ... for App Store Connect upload order
  dest_name="$(printf '%02d_%s' "$i" "$base")"
  dest="$OUT_DIR/$dest_name"

  if [ ! -f "$src" ]; then
    echo "[export-6.5] SKIP missing source: $src_name"
    missing=$((missing + 1))
    continue
  fi

  src_w="$(sips -g pixelWidth "$src" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
  src_h="$(sips -g pixelHeight "$src" 2>/dev/null | awk '/pixelHeight/ {print $2}')"
  echo "[export-6.5] resize $src_name (${src_w}x${src_h}) -> $dest_name (${TARGET_W}x${TARGET_H})"

  # Copy then resize in place so we never mutate the capture folder originals.
  cp "$src" "$dest"
  sips -z "$TARGET_H" "$TARGET_W" "$dest" >/dev/null

  # Flatten alpha if present (App Store rejects alpha).
  sips -s format png "$dest" >/dev/null

  out_w="$(sips -g pixelWidth "$dest" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
  out_h="$(sips -g pixelHeight "$dest" 2>/dev/null | awk '/pixelHeight/ {print $2}')"
  if [ "$out_w" != "$TARGET_W" ] || [ "$out_h" != "$TARGET_H" ]; then
    echo "[export-6.5] ERROR: expected ${TARGET_W}x${TARGET_H}, got ${out_w}x${out_h} for $dest_name" >&2
    exit 1
  fi
  echo "[export-6.5] OK $dest_name (${out_w}x${out_h})"
  exported=$((exported + 1))
done

echo
echo "[export-6.5] Done. exported=$exported missing=$missing"
echo "[export-6.5] Upload PNGs from: $OUT_DIR"
echo "[export-6.5] App Store Connect → iPhone → 6.5\" Display"
echo "[export-6.5] Tip: capture again with $SCRIPT_DIR/capture.sh if UI has changed since this folder."

if [ "$exported" -eq 0 ]; then
  echo "[export-6.5] ERROR: no screenshots exported" >&2
  exit 1
fi

open "$OUT_DIR" 2>/dev/null || true
