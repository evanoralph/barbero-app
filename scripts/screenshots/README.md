# App screenshot capture

Drives the iOS Simulator with [Maestro](https://maestro.mobile.dev) to walk
every screen in the app and save a screenshot of each one.

## Usage

```bash
# One-time setup:
#   1. Boot an iOS Simulator and run `npm run ios` so the dev client is installed.
#   2. Install Maestro: curl -Ls "https://get.maestro.mobile.dev" | bash

scripts/screenshots/capture.sh                # check routes, then capture
scripts/screenshots/capture.sh --skip-checks   # capture without the route check
scripts/screenshots/capture.sh --strict        # fail instead of warn on route drift
scripts/screenshots/capture.sh --device <UDID> # target a specific simulator
```

Screenshots are written to `~/Documents/barbero-app-screenshots/<timestamp>/`
(override with `SCREENSHOT_OUTPUT_DIR`), one PNG per screen, prefixed by
which flow captured it (`provider__07_profile.png`, etc.).

## App Store Connect 6.5" Display

Capture output is usually native Pro Max size (e.g. 1290×2796). App Store
Connect’s **iPhone → 6.5" Display** slot accepts portrait:

- **1284 × 2778** (default export)
- **1242 × 2688**

Resize a curated customer shortlist without re-running Maestro:

```bash
scripts/screenshots/export-app-store-6.5.sh \
  --from ~/Documents/barbero-app-screenshots/<timestamp>

# Optional: alternate accepted size
scripts/screenshots/export-app-store-6.5.sh \
  --from ~/Documents/barbero-app-screenshots/<timestamp> \
  --size 1242x2688
```

Writes `<capture-dir>/iphone-6.5/` with upload-ordered names
(`01_home.png`, `02_explore.png`, …). Default sources: home, explore,
provider profile, book flow, map. Upload those PNGs into App Store Connect
→ iPhone → 6.5" Display (first 3 appear on the install sheet).

## Layout

- `flows/auth.yaml`, `flows/provider.yaml`, `flows/customer.yaml` — one
  Maestro flow per role, each logging in via the `__DEV__`-only "Dev quick
  fill" button and walking every screen for that role.
- `flows/lib/ensure_logged_out.yaml` — shared preamble that relaunches the
  app and signs out if needed. **Don't use `launchApp: { clearState: true }`
  here** — on this dev-client build it wipes the client's stored bundler URL
  along with app storage, dropping the simulator into the native Expo
  launcher screen instead of the app.
- `routes.snapshot.txt` — the route list (`app/**/*.tsx`, minus `_layout`,
  `+html`, `+not-found`) as of the last time someone reviewed the flows
  against it.

## When routes change

`capture.sh` diffs the current `app/` route list against
`routes.snapshot.txt` and does a best-effort keyword search to make sure
each route is at least mentioned somewhere in `flows/*.yaml` (via the
"Screens:" comment at the top of each flow, or a step that references it).
It can't know *how* to capture a new screen — auth state, dynamic route
params, and this app's specific navigation quirks (see the comments in
`provider.yaml`) all took hands-on iteration to get right — so on drift it
warns and tells you what to look at, rather than trying to fix itself.

To pick up a new/changed screen:
1. Add (or update) a step in the relevant `flows/*.yaml` file.
2. Run `capture.sh` and check the new screenshot looks right.
3. Run `capture.sh --update-snapshot` to accept the new route list as the
   baseline (this doesn't capture anything, just updates
   `routes.snapshot.txt`).

## Known fragility

A few steps use screen-position taps (`point: "50%,30%"`) to open the first
item in a list, since list content is seeded/dynamic and has no stable
selector. These are marked `optional: true` so a missing list (e.g. no
pending bookings) skips that one screenshot instead of failing the whole
flow — if the list layout changes significantly, these coordinates may need
adjusting.
