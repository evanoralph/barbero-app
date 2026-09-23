#!/usr/bin/env bash
# Captures a screenshot of every screen in the app by driving the iOS
# Simulator and/or Android Emulator with Maestro (https://maestro.mobile.dev).
#
# Usage:
#   scripts/screenshots/capture.sh                      # iOS (default)
#   scripts/screenshots/capture.sh --platform android   # Android only
#   scripts/screenshots/capture.sh --platform ios       # iOS only
#   scripts/screenshots/capture.sh --platform both      # iOS then Android
#   scripts/screenshots/capture.sh --skip-checks        # capture without the route check
#   scripts/screenshots/capture.sh --strict             # fail instead of warn on route drift
#   scripts/screenshots/capture.sh --update-snapshot    # accept current routes as baseline, don't capture
#   scripts/screenshots/capture.sh --device <ID>        # target a specific simulator/emulator
#
# Requires: Maestro CLI (curl -Ls "https://get.maestro.mobile.dev" | bash),
# and a booted device with the dev client installed:
#   iOS:     npm run ios
#   Android: npm run android
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FLOWS_DIR="$SCRIPT_DIR/flows"
SNAPSHOT_FILE="$SCRIPT_DIR/routes.snapshot.txt"
BUNDLE_ID="com.beruapp.ai"
OUTPUT_ROOT="${SCREENSHOT_OUTPUT_DIR:-$HOME/Documents/barbero-app-screenshots}"

export PATH="$PATH:$HOME/.maestro/bin"

PLATFORM="ios"
STRICT=false
SKIP_CHECKS=false
UPDATE_SNAPSHOT=false
DEVICE_ID="${MAESTRO_DEVICE:-}"

log() {
  echo "[screenshots $(date '+%H:%M:%S')] $*" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) PLATFORM="$2"; shift ;;
    --strict) STRICT=true ;;
    --skip-checks) SKIP_CHECKS=true ;;
    --update-snapshot) UPDATE_SNAPSHOT=true ;;
    --device) DEVICE_ID="$2"; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

case "$PLATFORM" in
  ios|android|both) ;;
  *)
    echo "Unknown platform: $PLATFORM (use ios, android, or both)" >&2
    exit 1
    ;;
esac

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
  log "Updated $SNAPSHOT_FILE with $(printf '%s\n' "$current_routes" | wc -l | tr -d ' ') routes."
  exit 0
fi

if ! $SKIP_CHECKS; then
  known_routes="$( [ -f "$SNAPSHOT_FILE" ] && cat "$SNAPSHOT_FILE" || true)"
  added="$(comm -13 <(printf '%s\n' "$known_routes") <(printf '%s\n' "$current_routes"))"
  removed="$(comm -23 <(printf '%s\n' "$known_routes") <(printf '%s\n' "$current_routes"))"

  drift=false
  if [ -n "$added" ] || [ -n "$removed" ]; then
    drift=true
    log "WARN: App routes changed since flows were last verified against $SNAPSHOT_FILE:"
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
    log "WARN: Routes with no obvious mention in any flow file (may be genuinely uncovered):"
    printf "$uncovered" | sed 's/^/    ? /'
  fi

  if $drift; then
    echo "  Review flows in $FLOWS_DIR, then run with --update-snapshot to accept the new baseline."
    if $STRICT; then
      log "Exiting (--strict)."
      exit 1
    fi
    echo
  fi
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI not found. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 1
fi

resolve_ios_device() {
  local udid="${1:-}"
  if [ -z "$udid" ]; then
    udid="$(xcrun simctl list devices | grep -m1 'Booted' | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' || true)"
  fi
  if [ -z "$udid" ]; then
    echo "No booted iOS Simulator found. Boot one and run 'npm run ios' first." >&2
    return 1
  fi
  log "iOS simulator: $udid"
  if ! xcrun simctl get_app_container "$udid" "$BUNDLE_ID" >/dev/null 2>&1; then
    echo "$BUNDLE_ID is not installed on $udid. Run 'npm run ios' once first." >&2
    return 1
  fi
  log "iOS app installed ($BUNDLE_ID)"
  echo "$udid"
}

resolve_android_device() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found — install Android SDK platform-tools." >&2
    return 1
  fi
  local serial="${1:-}"
  if [ -z "$serial" ]; then
    serial="$(adb devices | awk 'NR>1 && $2=="device" { print $1; exit }')"
  fi
  if [ -z "$serial" ]; then
    echo "No Android emulator/device connected. Start one and run 'npm run android' first." >&2
    return 1
  fi
  log "Android device: $serial"
  if ! adb -s "$serial" shell pm list packages | grep -q "$BUNDLE_ID"; then
    echo "$BUNDLE_ID is not installed on $serial. Run 'npm run android' once first." >&2
    return 1
  fi
  log "Android app installed ($BUNDLE_ID)"
  echo "$serial"
}

# ---------------------------------------------------------------------------
# Layer 2: run the flows on one platform
# ---------------------------------------------------------------------------
run_platform() {
  local platform="$1"
  local device="$2"
  local platform_dir="$3"

  mkdir -p "$platform_dir"
  log "Capturing $platform screens on device=$device → $platform_dir"

  local failed_flows=""
  for flow_name in auth provider customer; do
    local flow_file="$FLOWS_DIR/$flow_name.yaml"
    [ -f "$flow_file" ] || continue
    log "[$platform] Capturing $flow_name screens..."
    local tmp_dir="$platform_dir/.run_$flow_name"

    # A flow failing shouldn't take the other flows down with it — run outside
    # -e, capture the exit code, and still collect whatever screenshots did
    # land before the failure.
    set +e
    maestro --platform "$platform" --device "$device" test \
      --test-output-dir "$tmp_dir" \
      "$flow_file"
    local flow_status=$?
    set -e
    if [ "$flow_status" -ne 0 ]; then
      failed_flows="$failed_flows $flow_name"
      log "WARN: [$platform] $flow_name flow did not complete cleanly (see $tmp_dir)."
    fi

    # --test-output-dir's docs say screenshots land directly in
    # <dir>/takeScreenshot/, but in practice Maestro still nests a
    # <timestamp>/<flowName>/ subfolder underneath — so search for it instead
    # of assuming an exact path.
    local found_any=false
    while IFS= read -r -d '' f; do
      found_any=true
      cp "$f" "$platform_dir/${flow_name}__$(basename "$f")"
    done < <(find "$tmp_dir" -path '*/takeScreenshot/*.png' -print0 2>/dev/null)
    if [ "$flow_status" -ne 0 ] || ! $found_any; then
      if ! $found_any; then
        log "WARN: [$platform] No screenshots found under $tmp_dir for $flow_name — check its layout."
        failed_flows="$failed_flows $flow_name"
      fi
      mkdir -p "$platform_dir/_debug"
      mv "$tmp_dir" "$platform_dir/_debug/$flow_name" 2>/dev/null || true
    else
      rm -rf "$tmp_dir"
    fi
  done

  if [ -n "$failed_flows" ]; then
    log "WARN: [$platform] These flows hit a step they couldn't recover from:$failed_flows"
    log "  Whatever they captured before that point is still in $platform_dir; full debug output is under $platform_dir/_debug/"
    return 1
  fi
  return 0
}

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="$OUTPUT_ROOT/$STAMP"
mkdir -p "$OUT_DIR"
log "Output root: $OUT_DIR (platform=$PLATFORM)"

overall_status=0
captured_dirs=""

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  # --device only applies when capturing a single platform (avoids passing an
  # iOS UDID into adb when --platform both).
  ios_device_arg=""
  [ "$PLATFORM" = "ios" ] && ios_device_arg="$DEVICE_ID"
  ios_device="$(resolve_ios_device "$ios_device_arg")" || exit 1
  # Single-platform runs keep screenshots at OUT_DIR root (iOS export script
  # expects that). Dual runs nest under ios/ / android/.
  if [ "$PLATFORM" = "both" ]; then
    ios_out="$OUT_DIR/ios"
  else
    ios_out="$OUT_DIR"
  fi
  if ! run_platform ios "$ios_device" "$ios_out"; then
    overall_status=1
  fi
  captured_dirs="$captured_dirs $ios_out"
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  android_device_arg=""
  [ "$PLATFORM" = "android" ] && android_device_arg="$DEVICE_ID"
  android_device="$(resolve_android_device "$android_device_arg")" || exit 1
  if [ "$PLATFORM" = "both" ]; then
    android_out="$OUT_DIR/android"
  else
    android_out="$OUT_DIR"
  fi
  if ! run_platform android "$android_device" "$android_out"; then
    overall_status=1
  fi
  captured_dirs="$captured_dirs $android_out"
fi

echo
log "Done. Screenshots in:$captured_dirs"
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  ios_hint="$OUT_DIR"
  [ "$PLATFORM" = "both" ] && ios_hint="$OUT_DIR/ios"
  echo "For App Store Connect 6.5\" Display (1284x2778), run:"
  echo "  $SCRIPT_DIR/export-app-store-6.5.sh --from \"$ios_hint\""
fi
if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  android_hint="$OUT_DIR"
  [ "$PLATFORM" = "both" ] && android_hint="$OUT_DIR/android"
  echo "Android PNGs are ready for Play Store framing (see play-store-screenshots skill)."
  echo "  Capture dir: $android_hint"
fi

open "$OUT_DIR" 2>/dev/null || true

exit "$overall_status"
