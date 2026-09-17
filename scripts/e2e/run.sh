#!/usr/bin/env bash
# Runs Maestro E2E tests for barbero-app on iOS Simulator and/or Android Emulator.
#
# Usage:
#   scripts/e2e/run.sh                          # smoke suite, both platforms
#   scripts/e2e/run.sh --platform ios           # iOS only
#   scripts/e2e/run.sh --platform android       # Android only
#   scripts/e2e/run.sh --suite full             # all happy-path flows
#   scripts/e2e/run.sh --flow auth/customer-login.yaml
#   scripts/e2e/run.sh --skip-checks            # skip route drift + prereq checks
#   scripts/e2e/run.sh --strict                 # fail on route drift
#   scripts/e2e/run.sh --update-snapshot        # update .maestro/routes.snapshot.txt only
#
# Requires: dev client installed, Maestro CLI, reachable API with seed accounts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FLOWS_ROOT="$PROJECT_ROOT/.maestro/flows"
SNAPSHOT_FILE="$PROJECT_ROOT/.maestro/routes.snapshot.txt"
BUNDLE_ID="com.beruapp.ai"
REPORT_ROOT="${E2E_REPORT_DIR:-$HOME/Documents/barbero-app-e2e-reports}"

export PATH="$PATH:$HOME/.maestro/bin"

PLATFORM="both"
SUITE="smoke"
FLOW=""
DEVICE_ID="${MAESTRO_DEVICE:-}"
SKIP_CHECKS=false
STRICT=false
UPDATE_SNAPSHOT=false

SMOKE_FLOWS=(
  "shared/cold-start.yaml"
  "auth/customer-login.yaml"
  "auth/provider-login.yaml"
  "auth/customer-sign-out.yaml"
  "auth/provider-sign-out.yaml"
  "customer/tab-navigation.yaml"
  "provider/tab-navigation.yaml"
)

FULL_FLOWS=(
  "${SMOKE_FLOWS[@]}"
  "auth/forgot-password.yaml"
  "auth/session-restore.yaml"
  "customer/explore-profile.yaml"
  "customer/book-flow.yaml"
  "customer/booking-detail.yaml"
  "customer/messages.yaml"
  "customer/account-screens.yaml"
  "customer/map.yaml"
  "provider/booking-detail.yaml"
  "provider/inbox.yaml"
  "provider/profile-screens.yaml"
)

log() {
  echo "[e2e $(date '+%H:%M:%S')] $*"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) PLATFORM="$2"; shift ;;
    --suite) SUITE="$2"; shift ;;
    --flow) FLOW="$2"; shift ;;
    --device) DEVICE_ID="$2"; shift ;;
    --skip-checks) SKIP_CHECKS=true ;;
    --strict) STRICT=true ;;
    --update-snapshot) UPDATE_SNAPSHOT=true ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Route drift check (same pattern as scripts/screenshots/capture.sh)
# ---------------------------------------------------------------------------
current_routes="$(cd "$PROJECT_ROOT" && find app -type f \( -name "*.tsx" -o -name "*.ts" \) \
  ! -name "_layout.tsx" ! -name "+html.tsx" ! -name "+not-found.tsx" \
  | sed 's#^app/##' | sort)"

if $UPDATE_SNAPSHOT; then
  printf '%s\n' "$current_routes" > "$SNAPSHOT_FILE"
  log "Updated $SNAPSHOT_FILE ($(printf '%s\n' "$current_routes" | wc -l | tr -d ' ') routes)"
  exit 0
fi

if ! $SKIP_CHECKS; then
  known_routes="$( [ -f "$SNAPSHOT_FILE" ] && cat "$SNAPSHOT_FILE" || true)"
  added="$(comm -13 <(printf '%s\n' "$known_routes") <(printf '%s\n' "$current_routes"))"
  removed="$(comm -23 <(printf '%s\n' "$known_routes") <(printf '%s\n' "$current_routes"))"

  if [ -n "$added" ] || [ -n "$removed" ]; then
    log "WARN: App routes changed since E2E flows were last verified:"
    [ -n "$added" ] && printf '%s\n' "$added" | sed 's/^/  + /'
    [ -n "$removed" ] && printf '%s\n' "$removed" | sed 's/^/  - /'
    log "Review .maestro/flows/ and docs/maestro-e2e.md, then run with --update-snapshot"
    if $STRICT; then
      log "Exiting (--strict)"
      exit 1
    fi
  fi

  bash "$SCRIPT_DIR/check-prerequisites.sh" "$PLATFORM" "$DEVICE_ID"
fi

if [ -n "$FLOW" ]; then
  FLOWS=("$FLOW")
elif [ "$SUITE" = "full" ]; then
  FLOWS=("${FULL_FLOWS[@]}")
else
  FLOWS=("${SMOKE_FLOWS[@]}")
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="$REPORT_ROOT/$STAMP"
mkdir -p "$OUT_DIR"

run_platform() {
  local platform="$1"
  local device="$2"
  local platform_dir="$OUT_DIR/$platform"
  mkdir -p "$platform_dir"

  local failed=""
  local passed=0
  local total=0

  log "Starting $platform run (suite=$SUITE, flows=${#FLOWS[@]}) device=$device"

  for rel in "${FLOWS[@]}"; do
    local flow_file="$FLOWS_ROOT/$rel"
    if [ ! -f "$flow_file" ]; then
      log "WARN: missing flow $flow_file — skipping"
      continue
    fi
    total=$((total + 1))
    local flow_name="${rel%.yaml}"
    local flow_out="$platform_dir/$flow_name"
    mkdir -p "$flow_out"

    log "[$platform] RUN $rel"
    set +e
    maestro --platform "$platform" --device "$device" test \
      --format junit \
      --test-output-dir "$flow_out" \
      "$flow_file" 2>&1 | tee "$flow_out/run.log"
    local status=$?
    set -e

    if [ "$status" -eq 0 ]; then
      log "[$platform] PASS $rel"
      passed=$((passed + 1))
    else
      log "[$platform] FAIL $rel (exit $status) — see $flow_out/run.log"
      failed="$failed $rel"
    fi
  done

  log "[$platform] Summary: $passed/$total passed"
  if [ -n "$failed" ]; then
    log "[$platform] Failed:$failed"
    return 1
  fi
  return 0
}

overall_status=0

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  ios_device="$DEVICE_ID"
  if [ -z "$ios_device" ]; then
    ios_device="$(xcrun simctl list devices | grep -m1 'Booted' | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}')"
  fi
  if ! run_platform ios "$ios_device"; then
    overall_status=1
  fi
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  android_device="$DEVICE_ID"
  if [ -z "$android_device" ]; then
    android_device="$(adb devices | awk 'NR>1 && $2=="device" { print $1; exit }')"
  fi
  if ! run_platform android "$android_device"; then
    overall_status=1
  fi
fi

log "Reports in $OUT_DIR"
open "$OUT_DIR" 2>/dev/null || true

exit "$overall_status"
