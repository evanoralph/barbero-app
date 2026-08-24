#!/usr/bin/env bash
# Captures a screenshot of every screen in the app by driving the iOS
# Simulator with Maestro (https://maestro.mobile.dev).
#
# Usage:
#   scripts/screenshots/capture.sh                 # check routes, then capture
#   scripts/screenshots/capture.sh --skip-checks    # capture without the route check
#   scripts/screenshots/capture.sh --strict         # fail instead of warn on drift
#   scripts/screenshots/capture.sh --update-snapshot  # accept current routes as baseline, don't capture
#   scripts/screenshots/capture.sh --device <UDID>  # target a specific simulator
#
# Requires: a booted iOS Simulator with the dev client already installed
# (run `npm run ios` once beforehand), and the Maestro CLI
# (curl -Ls "https://get.maestro.mobile.dev" | bash).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FLOWS_DIR="$SCRIPT_DIR/flows"
SNAPSHOT_FILE="$SCRIPT_DIR/routes.snapshot.txt"
BUNDLE_ID="com.barbero.app"
OUTPUT_ROOT="${SCREENSHOT_OUTPUT_DIR:-$HOME/Documents/barbero-app-screenshots}"

export PATH="$PATH:$HOME/.maestro/bin"

STRICT=false
SKIP_CHECKS=false
UPDATE_SNAPSHOT=false
DEVICE_ID="${MAESTRO_DEVICE:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --strict) STRICT=true ;;
    --skip-checks) SKIP_CHECKS=true ;;
    --update-snapshot) UPDATE_SNAPSHOT=true ;;
    --device) DEVICE_ID="$2"; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Layer 1: has the app's route list drifted since the flows were last checked?
# ---------------------------------------------------------------------------
# This can't know *how* to capture a new screen (auth state, dynamic ids, and
# app-specific navigation quirks all require a human to write the Maestro
# steps — see the comments in flows/*.yaml for what that took last time).
# What it *can* do reliably: tell you a route appeared or disappeared, and do
# a best-effort check that every current route is at least mentioned by
# keyword in one of the flow files, so a silently-stale flow doesn't just
# skip a screen forever.
current_routes="$(cd "$PROJECT_ROOT" && find app -type f \( -name "*.tsx" -o -name "*.ts" \) \
  ! -name "_layout.tsx" ! -name "+html.tsx" ! -name "+not-found.tsx" \
  | sed 's#^app/##' | sort)"

if $UPDATE_SNAPSHOT; then
  printf '%s\n' "$current_routes" > "$SNAPSHOT_FILE"
  echo "Updated $SNAPSHOT_FILE with $(printf '%s\n' "$current_routes" | wc -l | tr -d ' ') routes."
  exit 0
fi

if ! $SKIP_CHECKS; then
  known_routes="$( [ -f "$SNAPSHOT_FILE" ] && cat "$SNAPSHOT_FILE" || true)"
  added="$(comm -13 <(printf '%s\n' "$known_routes") <(printf '%s\n' "$current_routes"))"
  removed="$(comm -23 <(printf '%s\n' "$known_routes") <(printf '%s\n' "$current_routes"))"

  drift=false
  if [ -n "$added" ] || [ -n "$removed" ]; then
    drift=true
    echo "⚠️  App routes changed since flows were last verified against $SNAPSHOT_FILE:"
    if [ -n "$added" ]; then
      echo "  New routes (make sure a flow captures these):"
      printf '%s\n' "$added" | sed 's/^/    + /'
    fi
    if [ -n "$removed" ]; then
      echo "  Removed routes (flows may still reference dead screens):"
      printf '%s\n' "$removed" | sed 's/^/    - /'
    fi
  fi

  # Coverage heuristic: for each current route, derive a rough keyword and
  # check it's mentioned somewhere in flows/*.yaml. Index/dynamic segments
  # use their parent directory name instead (e.g. bookings/[id].tsx -> bookings).
  uncovered=""
  while IFS= read -r route; do
    [ -z "$route" ] && continue
    base="$(basename "$route" .tsx)"
    base="$(basename "$base" .ts)"
    if [ "$base" = "index" ] || [[ "$base" =~ ^\[.*\]$ ]]; then
      keyword="$(basename "$(dirname "$route")")"
    else
      keyword="$base"
    fi
    keyword="${keyword//[\[\]()]/}"
    [ -z "$keyword" ] && continue
    if ! grep -qi "$keyword" "$FLOWS_DIR"/*.yaml 2>/dev/null; then
      uncovered="$uncovered$route (keyword: $keyword)\n"
    fi
  done <<< "$current_routes"

  if [ -n "$uncovered" ]; then
    drift=true
    echo "⚠️  Routes with no obvious mention in any flow file (may be genuinely uncovered):"
    printf "$uncovered" | sed 's/^/    ? /'
  fi

  if $drift; then
    echo "  Review flows in $FLOWS_DIR, then run with --update-snapshot to accept the new baseline."
    if $STRICT; then
      echo "Exiting (--strict)."
      exit 1
    fi
    echo
  fi
fi

# ---------------------------------------------------------------------------
# Layer 2: run the flows
# ---------------------------------------------------------------------------
if [ -z "$DEVICE_ID" ]; then
  DEVICE_ID="$(xcrun simctl list devices | grep -m1 'Booted' | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' || true)"
fi
if [ -z "$DEVICE_ID" ]; then
  echo "No booted iOS Simulator found. Boot one and run 'npm run ios' first." >&2
  exit 1
fi

if ! xcrun simctl get_app_container "$DEVICE_ID" "$BUNDLE_ID" >/dev/null 2>&1; then
  echo "$BUNDLE_ID is not installed on $DEVICE_ID. Run 'npm run ios' once first." >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="$OUTPUT_ROOT/$STAMP"
mkdir -p "$OUT_DIR"

failed_flows=""
for flow_name in auth provider customer; do
  flow_file="$FLOWS_DIR/$flow_name.yaml"
  [ -f "$flow_file" ] || continue
  echo "==> Capturing $flow_name screens..."
  tmp_dir="$OUT_DIR/.run_$flow_name"

  # A flow failing shouldn't take the other flows down with it — run outside
  # -e, capture the exit code, and still collect whatever screenshots did
  # land before the failure.
  set +e
  maestro --platform ios --device "$DEVICE_ID" test \
    --test-output-dir "$tmp_dir" \
    "$flow_file"
  flow_status=$?
  set -e
  if [ "$flow_status" -ne 0 ]; then
    failed_flows="$failed_flows $flow_name"
    echo "⚠️  $flow_name flow did not complete cleanly (see $tmp_dir for its debug output before it's copied below)."
  fi

  # --test-output-dir's docs say screenshots land directly in
  # <dir>/takeScreenshot/, but in practice Maestro still nests a
  # <timestamp>/<flowName>/ subfolder underneath — so search for it instead
  # of assuming an exact path.
  found_any=false
  while IFS= read -r -d '' f; do
    found_any=true
    cp "$f" "$OUT_DIR/${flow_name}__$(basename "$f")"
  done < <(find "$tmp_dir" -path '*/takeScreenshot/*.png' -print0 2>/dev/null)
  if [ "$flow_status" -ne 0 ] || ! $found_any; then
    if ! $found_any; then
      echo "⚠️  No screenshots found under $tmp_dir for $flow_name — check its layout."
      failed_flows="$failed_flows $flow_name"
    fi
    mkdir -p "$OUT_DIR/_debug"
    mv "$tmp_dir" "$OUT_DIR/_debug/$flow_name" 2>/dev/null || true
  else
    rm -rf "$tmp_dir"
  fi
done

echo
echo "Done. Screenshots in $OUT_DIR"
echo "For App Store Connect 6.5\" Display (1284x2778), run:"
echo "  $SCRIPT_DIR/export-app-store-6.5.sh --from \"$OUT_DIR\""
if [ -n "$failed_flows" ]; then
  echo "⚠️  These flows hit a step they couldn't recover from:$failed_flows"
  echo "  Whatever they captured before that point is still in $OUT_DIR; full debug output is under $OUT_DIR/_debug/"
fi
open "$OUT_DIR" 2>/dev/null || true

[ -z "$failed_flows" ]
