# Maestro E2E Tests

Local end-to-end tests for the Beru mobile app (`barbero-app`), driven by
[Maestro](https://maestro.mobile.dev) on iOS Simulator and Android Emulator.

**This doc is the single source of truth** for scenario coverage, how to run
tests, how to read results, and how to update flows when the app changes.

Related:

- App Store screenshot flows (separate): [`scripts/screenshots/README.md`](../scripts/screenshots/README.md)
- Web/API tests (sibling repo): [`barbero/docs/testing-specs.md`](../../barbero/docs/testing-specs.md)

---

## Prerequisites

1. **Maestro CLI**

   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Dev client installed** on a booted simulator/emulator:

   ```bash
   npm run ios       # iOS Simulator
   npm run android   # Android Emulator
   ```

3. **Metro bundler** running (`npm run start:dev-client`) so the dev client can load JS.

4. **Reachable API** with seed accounts. Default in `.env`:

   ```
   EXPO_PUBLIC_API_URL=https://api.beru.digital/api/v1
   ```

   | Role | Email | Password |
   | --- | --- | --- |
   | Customer | `customer@example.test` | `change-me-customer-8chars` |
   | Provider | `provider@example.test` | `change-me-provider-8chars` |

5. Tests require a **`__DEV__` build** — login flows use the "Dev quick fill" buttons on the login screen.

---

## Quick start

```bash
# Smoke suite (recommended first run) — both platforms
npm run test:e2e:smoke

# Platform-specific
npm run test:e2e:ios
npm run test:e2e:android

# Full happy-path suite
npm run test:e2e:full

# Single flow
bash scripts/e2e/run.sh --flow auth/customer-login.yaml --platform ios
```

Reports are written to `~/Documents/barbero-app-e2e-reports/<timestamp>/` (override with `E2E_REPORT_DIR`).

---

## Scenario matrix

Status values: **passing** (implemented), **planned** (not yet implemented), **manual** (needs special setup).

### Shared / boot

| ID | Scenario | Flow file | Phase | iOS | Android | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | Cold start (logged out) | `shared/cold-start.yaml` | 1 | yes | yes | passing |
| S-02 | Server unreachable | — | 3 | — | — | planned |

### Auth

| ID | Scenario | Flow file | Phase | iOS | Android | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | Customer login | `auth/customer-login.yaml` | 1 | yes | yes | passing |
| A-02 | Provider login | `auth/provider-login.yaml` | 1 | yes | yes | passing |
| A-03 | Forgot password | `auth/forgot-password.yaml` | 2 | yes | yes | passing |
| A-04 | Sign out (customer) | `auth/customer-sign-out.yaml` | 1 | yes | yes | passing |
| A-05 | Sign out (provider) | `auth/provider-sign-out.yaml` | 1 | yes | yes | passing |
| A-06 | Session restore | `auth/session-restore.yaml` | 2 | yes | yes | passing |

### Customer

| ID | Scenario | Flow file | Phase | iOS | Android | Status |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | Home loads | `customer/tab-navigation.yaml` | 1 | yes | yes | passing |
| C-02 | Explore tab | `customer/tab-navigation.yaml` | 1 | yes | yes | passing |
| C-03 | Provider profile | `customer/explore-profile.yaml` | 2 | yes | yes | passing |
| C-04 | Book appointment | `customer/book-flow.yaml` | 2 | yes | yes | passing |
| C-05 | Bookings list | `customer/tab-navigation.yaml` | 1 | yes | yes | passing |
| C-06 | Booking detail | `customer/booking-detail.yaml` | 2 | yes | yes | passing |
| C-07 | Messages inbox | `customer/messages.yaml` | 2 | yes | yes | passing |
| C-08 | Message thread | `customer/messages.yaml` | 2 | yes | yes | passing |
| C-09 | Send message | — | 3 | — | — | planned |
| C-10 | Account hub | `customer/tab-navigation.yaml` | 1 | yes | yes | passing |
| C-11 | Settings | `customer/account-screens.yaml` | 2 | yes | yes | passing |
| C-12 | Saved providers | `customer/account-screens.yaml` | 2 | yes | yes | passing |
| C-13 | Payments | `customer/account-screens.yaml` | 2 | yes | yes | passing |
| C-14 | Map | `customer/map.yaml` | 2 | yes | yes | passing |

### Provider

| ID | Scenario | Flow file | Phase | iOS | Android | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | Dashboard KPIs | `provider/tab-navigation.yaml` | 1 | yes | yes | passing |
| P-02 | Bookings list | `provider/tab-navigation.yaml` | 1 | yes | yes | passing |
| P-03 | Booking detail | `provider/booking-detail.yaml` | 2 | yes | yes | passing |
| P-04 | Accept/decline booking | — | 3 | — | — | planned |
| P-05 | Hours / availability save | — | 3 | — | — | planned |
| P-06 | Inbox | `provider/inbox.yaml` | 2 | yes | yes | passing |
| P-07 | Message thread reply | — | 3 | — | — | planned |
| P-08 | Profile | `provider/tab-navigation.yaml` | 1 | yes | yes | passing |
| P-09 | Public profile preview | `provider/profile-screens.yaml` | 2 | yes | yes | passing |
| P-10 | Manage services | `provider/profile-screens.yaml` | 2 | yes | yes | passing |
| P-11 | Manage portfolio | `provider/profile-screens.yaml` | 2 | yes | yes | passing |
| P-12 | Subscription plan | `provider/profile-screens.yaml` | 2 | yes | yes | passing |

---

## Test suites

| Suite | npm script | Flows |
| --- | --- | --- |
| **smoke** | `npm run test:e2e:smoke` | Phase 1 — login, sign-out, tab navigation (7 flows) |
| **full** | `npm run test:e2e:full` | Smoke + Phase 2 navigation flows (18 flows) |

### Smoke flows (Phase 1)

1. `shared/cold-start.yaml`
2. `auth/customer-login.yaml`
3. `auth/provider-login.yaml`
4. `auth/customer-sign-out.yaml`
5. `auth/provider-sign-out.yaml`
6. `customer/tab-navigation.yaml`
7. `provider/tab-navigation.yaml`

---

## File layout

```
.maestro/
├── config.yaml              # appId: com.beruapp.ai
├── routes.snapshot.txt      # route drift baseline
├── lib/
│   ├── ensure_logged_out.yaml
│   ├── login_customer.yaml
│   └── login_provider.yaml
└── flows/
    ├── shared/
    ├── auth/
    ├── customer/
    └── provider/

scripts/e2e/
├── run.sh                   # main runner
└── check-prerequisites.sh   # device + Maestro + API checks
```

---

## How to read results

After a run, open the report directory (Finder opens automatically on macOS):

```
~/Documents/barbero-app-e2e-reports/<timestamp>/
├── ios/
│   └── auth/customer-login/
│       ├── run.log          # full Maestro output
│       └── …                # JUnit + debug artifacts
└── android/
    └── …
```

- **PASS** — flow completed; assertions succeeded.
- **FAIL** — check `run.log` for the failing step; Maestro saves screenshots on failure under the flow output dir.
- Exit code `0` = all flows passed on all requested platforms.

---

## How to update tests

### When you add or rename a screen

1. Add/update steps in the relevant `.maestro/flows/**/*.yaml` file.
2. Add `testID` props on new interactive elements (preferred over coordinate taps).
3. Run the affected flow:

   ```bash
   bash scripts/e2e/run.sh --flow customer/tab-navigation.yaml --platform ios
   ```

4. Run smoke on both platforms:

   ```bash
   npm run test:e2e:smoke
   ```

5. Accept the new route baseline:

   ```bash
   bash scripts/e2e/run.sh --update-snapshot
   ```

### Route drift detection

`run.sh` diffs `app/` routes against `.maestro/routes.snapshot.txt`. On drift it warns (or exits with `--strict`).

### Selector guidelines

| Prefer | Avoid |
| --- | --- |
| `testID` (`id: "tab-home"`) | Coordinate taps unless marked `optional: true` |
| Stable visible text | Plain `"Bookings"` tap (matches Quick Action buttons) |
| Tab regex `.*Home, tab.*` | `launchApp: { clearState: true }` on dev client |

**testIDs added for E2E:**

| testID | Location |
| --- | --- |
| `dev-fill-customer` | Login dev quick fill |
| `dev-fill-provider` | Login dev quick fill |
| `sign-in-button` | Login submit |
| `sign-out-button` | Account + provider profile |
| `tab-home`, `tab-explore`, `tab-bookings`, `tab-account` | Customer tabs |
| `tab-dashboard`, `tab-bookings`, `tab-hours`, `tab-profile` | Provider tabs |

### Shared lib flows

- **`ensure_logged_out.yaml`** — relaunch app; sign out if session exists. Never uses `clearState: true` (breaks dev-client bundler URL).
- **`login_customer.yaml`** / **`login_provider.yaml`** — dev quick fill + sign in + assert landing tab.

---

## Runner options

```bash
bash scripts/e2e/run.sh [options]

  --platform ios|android|both   Default: both
  --suite smoke|full            Default: smoke
  --flow <path>                 Run one flow under .maestro/flows/
  --device <id>                 Simulator UDID or adb serial
  --skip-checks                 Skip route drift + prerequisite checks
  --strict                      Fail on route drift
  --update-snapshot             Update routes.snapshot.txt only
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_REPORT_DIR` | `~/Documents/barbero-app-e2e-reports` | Report output root |
| `MAESTRO_DEVICE` | auto-detect | Default device ID |

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `No booted iOS Simulator` | Open Simulator, run `npm run ios` |
| `com.beruapp.ai not installed` | Run `npm run ios` or `npm run android` once |
| Login timeout | Check API health; confirm seed accounts exist |
| Expo launcher instead of app | Do not use `clearState: true`; use `ensure_logged_out.yaml` |
| Tab tap hits wrong button | Use `id: "tab-*"` testIDs or `.*Label, tab.*` regex |
| Android API unreachable | Emulator needs reachable host; see README troubleshooting |
| Flow passes on iOS, fails Android | Check `run.log` per platform; tab a11y labels may differ slightly |

---

## Out of scope (local v1)

- CI / Maestro Cloud integration
- Admin role (mobile unsupported)
- Stripe checkout in book flow
- Phase 3 write flows (send message, accept booking, save availability)

When adding Phase 3 scenarios, add a row to the matrix above and create the flow file under `.maestro/flows/`.
