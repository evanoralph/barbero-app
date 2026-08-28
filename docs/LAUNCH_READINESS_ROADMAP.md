# Launch Readiness Roadmap

**Last audited:** 2026-08-25
**Scope:** Website (`barbero`) + Mobile app (`barbero-app`)
**Twin copy:** Keep this file in sync with `barbero/docs/LAUNCH_READINESS_ROADMAP.md`.

**Why this doc exists:** `docs/roadmap.md` and `docs/implementation-tracker.md` (both repos) mark nearly every task `[x]` complete, including "Payments, subscriptions, premium" — but on direct code inspection, payments are entirely fake end-to-end. This doc is evidence-based: every claim below was verified by reading the actual source, not by trusting other docs. Where this doc conflicts with `roadmap.md` / `implementation-tracker.md`, **trust this one** — but re-verify against code before acting, since this too will drift over time. `docs/GO_LIVE.md` (audited 2026-08-18) is the other reliable doc; this one supersedes it where dates overlap and adds items GO_LIVE.md missed (e.g. the new provider self-signup flow, real image upload landing after its audit date).

---

## Executive summary

The app is genuinely solid for a **closed, invite-only beta**: auth, discovery, booking, messaging, provider workspace, admin ops, and — as of a commit on 2026-08-24 — a real provider self-signup flow all work against real backends with real data. It is **not ready for a public launch that touches real money**: every payment surface (payment methods, payment history, subscriptions, admin revenue) is fake/synthetic, and Stripe integration is a literal stub that has never been wired up. A handful of other gaps (push notifications don't reach the backend, no booking confirmation email, web map is simulated, mobile has zero tests) round out what's left before a full public launch.

---

## What's actually solid (verified, don't rebuild)

| Area | Evidence |
| --- | --- |
| Auth, session, RBAC, lockout | Web + mobile login/session flows, working role guards |
| Discovery, search, provider profiles, favorites | Web + mobile, backed by real API |
| Booking create / list / detail / cancel | Web + mobile, real API |
| Messaging with live threads | Real DDP subscriptions: `use-messages-thread-live.ts`, `use-typing-indicator.ts`, `use-conversations-live.ts` |
| Provider workspace | Dashboard, availability, bookings, analytics, profile/services/portfolio CRUD — both apps |
| **Provider self-signup** | `apps/web/app/apply/*` (account → business → location → proofs → done) + admin approval queue, shipped 2026-08-24. Not yet mentioned in any tracker or `GO_LIVE.md` — documented only in `barbero/docs/invite-only-ops.md`. |
| **Real image upload** | S3 presign flow on both web (`components/dashboard/image-upload-field.tsx`) and mobile (`src/components/ImageUploadField.tsx` + `expo-image-picker`). Resolves a `GO_LIVE.md` item still marked open there. |
| Admin review moderation | Real CRUD against `ModerationItemsCollection`, not a stub |
| Mobile native map | Real `react-native-maps` integration (`src/components/ProvidersMapView.tsx`) |
| API test coverage | 14 REST integration test files in `apps/api-meteor/tests/`; CI runs lint/typecheck/build/api-tests/e2e for the web repo |
| EAS / App Store Connect config | Real identifiers, not placeholders: `com.beruapp.ai`, real Apple team/app IDs |

---

## Critical blocker: payments are 100% fake

Nowhere in either app does real money move. This is the single biggest gap before any launch that charges customers or providers.

| Surface | Reality |
| --- | --- |
| Payment methods | User-typed last-4/brand string saved raw to Mongo — no card validation, no processor call (`apps/api-meteor/imports/api/payments/queries.ts`) |
| Payment history | Synthetic — flat `DEFAULT_BOOKING_AMOUNT = 50` per booking, fake deterministic card labels |
| Subscriptions | A DB boolean flip (`isPremium` / `isFeatured`) — no charge ever occurs |
| Admin revenue / transactions | Computed from the same fake $50-per-booking math, not real transaction data |
| Stripe SDK | `stripe-checkout.ts` / `stripe-webhook.ts` exist but are literal stubs returning `STRIPE_NOT_IMPLEMENTED`; **zero** `stripe` npm package imports anywhere in either repo |
| Mobile payments screen | Component is literally named `PaymentsStubScreen`, static copy only, no API calls |

The UI already discloses this honestly in places ("Online card checkout is coming soon", "Payments (stub)") — keep that disclosure until Phase B below ships.

---

## Gaps by domain

### Notifications & comms
- **Push notifications — dead end, not partial.** Mobile registers an Expo push token (`src/utils/push.ts`) and logs it, but it is never sent to any backend endpoint. No API stores tokens, no server-side send capability exists anywhere in `apps/api-meteor`. New bookings/messages trigger nothing.
- **Booking confirmation email — not sent.** Real SMTP capability exists (Meteor `Email` package via `MAIL_URL`) and is wired to password reset only. `apps/api-meteor/imports/api/bookings/methods.ts` sends no email, not even a dev console log.
- Notification preference toggles: not built.

### Messaging
- Chat image attach (`MessageThreadView.tsx`) is a stub — `console.log("image stub")` on tap, not wired to the upload infra that already exists elsewhere in the app.

### Web-specific
- **Map is simulated.** `apps/web/components/providers-map.tsx` is a hand-built CSS/pixel-math pan-zoom map (`lib/geo/map-math.ts`) with no real tile provider (no Mapbox/Google Maps/Leaflet). Mobile already has a real native map — web is the gap.
- `bookings.live` / `providerBookings.live` DDP publications are defined server-side but never subscribed to from web — dead code or a missing live-update feature.
- Unread message counts are hardcoded to 0.
- Reschedule flow incomplete — `?reschedule=` query param on the book page isn't honored.
- Admin booking detail "Refund" button is a "coming soon" stub.
- No frontend unit test layer — Vitest was never added, only Playwright e2e (4 specs).
- Confirmed orphaned/dead files, safe to delete: `apps/web/lib/mock-data.ts`, `admin-mock-data.ts`, `customer-mock-data.ts`, `admin-users-session.ts`.

### Mobile-specific
- **Zero automated tests of any kind, no CI at all.** No `__tests__` dirs, no test script in `package.json`, no `.github/workflows`.
- No crash/error monitoring (no Sentry or equivalent) — only a dev-gated console logger.
- Booking notes field in the UI isn't wired through to the `createBooking` API.
- No post-booking "write a review" prompt/flow.
- No deep-link password reset (`barbero://` scheme) — manual token paste only.

### Security & ops
- **Committed SSH private key** `apps/api-meteor/.deploy/Barbero.pem` — still not rotated or purged from git history.
- Seed/admin passwords may still be `change-me-*` in production settings — needs explicit confirmation before go-live.
- Production secrets (Vercel `METEOR_API_URL`, Mup `WEB_ORIGIN`, EAS env) not yet confirmed set.
- Support contact `support@beru.app` is still a placeholder in both ops runbooks.

### Branding & compliance
- "Beru vs Barbero" naming cutover is incomplete across metadata, titles, footers, logos — visibly mid-edit right now (logo asset files and `BrandLogo.tsx` show as modified in git status).
- App Store / Play privacy questionnaires and data-safety forms not filed.
- Store listing metadata (age rating, contact, screenshots) not finalized.

---

## Phased roadmap

### Phase A — Close the beta gate (ops-heavy, days)
1. Rotate and purge the committed SSH key from git history; move to CI secrets only.
2. Confirm all production secrets are actually set (Vercel, Mup, EAS) and no `change-me-*` passwords remain.
3. Run the mobile README smoke checklist on a real device against staging.
4. Delete the confirmed-dead mock files (`mock-data.ts`, `admin-mock-data.ts`, `customer-mock-data.ts`, `admin-users-session.ts`).
5. Lock the brand decision (Beru vs Barbero) for this launch and finish the cutover.

### Phase B — Public-launch blockers (real engineering, weeks)
1. Real Stripe integration end-to-end: checkout for bookings and/or Pro subscription, webhook handling, replace fake payment methods/history/admin-revenue with real Stripe-sourced data — web + mobile.
2. Wire real push notifications: send the Expo token to the backend, trigger sends on new booking/message events.
3. Transactional email: at minimum, booking confirmation and cancellation.
4. Decide on public customer signup (currently admin-invite-only by design) or explicitly keep invite-only for v1.
5. Real map SDK on web (parity with mobile's `react-native-maps`).
6. Wire chat image attach into the existing upload infrastructure.
7. Complete reschedule flow; fix unread message counts.

### Phase C — Quality & resilience (parallelizable with B)
1. Add a Vitest unit layer for web.
2. Add any test layer + CI for mobile (currently zero).
3. Add mobile crash/error monitoring.
4. Post-booking review flow (mobile).
5. Notification preference toggles.

### Phase D — Store & compliance (before public store listing)
1. App Store / Play privacy questionnaires and data-safety forms.
2. Finalize store listing metadata and screenshots.
3. Deep-link password reset for mobile.

---

## Related docs

- `docs/GO_LIVE.md` — the prior audit (2026-08-18); this doc supersedes it but GO_LIVE's phase framing (soft launch vs full launch) is still useful.
- `docs/ops-runbook.md` — deploy/rollback/incident procedures, still accurate.
- `docs/roadmap.md`, `docs/implementation-tracker.md` — feature-build history; **status columns are overstated**, treat as a changelog of what was attempted, not a source of truth on current completeness.
- `barbero/docs/invite-only-ops.md` — documents the provider self-signup flow this doc references above.
