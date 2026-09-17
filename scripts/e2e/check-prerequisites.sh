#!/usr/bin/env bash
# Checks Maestro E2E prerequisites for barbero-app.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUNDLE_ID="com.beruapp.ai"

export PATH="$PATH:$HOME/.maestro/bin"

PLATFORM="${1:-both}"
DEVICE_ID="${2:-}"

log() {
  echo "[e2e-prereq $(date '+%H:%M:%S')] $*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

if ! command -v maestro >/dev/null 2>&1; then
  fail "Maestro CLI not found. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
fi

log "Maestro $(maestro --version 2>/dev/null || echo 'installed')"

check_api() {
  local api_url=""
  if [ -f "$PROJECT_ROOT/.env" ]; then
    api_url="$(grep -E '^EXPO_PUBLIC_API_URL=' "$PROJECT_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  fi
  if [ -z "$api_url" ]; then
    log "WARN: EXPO_PUBLIC_API_URL not set in .env — API health not checked"
    return 0
  fi
  local health_url="${api_url%/api/v1}/health"
  if curl -fsS --max-time 5 "$health_url" >/dev/null 2>&1; then
    log "API health OK ($health_url)"
  else
    log "WARN: API not reachable at $health_url — login flows may fail"
  fi
}

check_ios() {
  local udid="$DEVICE_ID"
  if [ -z "$udid" ]; then
    udid="$(xcrun simctl list devices | grep -m1 'Booted' | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' || true)"
  fi
  if [ -z "$udid" ]; then
    fail "No booted iOS Simulator. Boot one and run: npm run ios"
  fi
  log "iOS simulator: $udid"
  if ! xcrun simctl get_app_container "$udid" "$BUNDLE_ID" >/dev/null 2>&1; then
    fail "$BUNDLE_ID not installed on iOS simulator. Run: npm run ios"
  fi
  log "iOS app installed ($BUNDLE_ID)"
  echo "$udid"
}

check_android() {
  if ! command -v adb >/dev/null 2>&1; then
    fail "adb not found — install Android SDK platform-tools"
  fi
  local serial="$DEVICE_ID"
  if [ -z "$serial" ]; then
    serial="$(adb devices | awk 'NR>1 && $2=="device" { print $1; exit }')"
  fi
  if [ -z "$serial" ]; then
    fail "No Android emulator/device connected. Start one and run: npm run android"
  fi
  log "Android device: $serial"
  if ! adb -s "$serial" shell pm list packages | grep -q "$BUNDLE_ID"; then
    fail "$BUNDLE_ID not installed on Android device. Run: npm run android"
  fi
  log "Android app installed ($BUNDLE_ID)"
  echo "$serial"
}

check_api

case "$PLATFORM" in
  ios)
    check_ios >/dev/null
    ;;
  android)
    check_android >/dev/null
    ;;
  both)
    check_ios >/dev/null
    check_android >/dev/null
    ;;
  *)
    fail "Unknown platform: $PLATFORM (use ios, android, or both)"
    ;;
esac

log "Prerequisites OK for platform=$PLATFORM"
