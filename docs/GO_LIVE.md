# Go Live Checklist

**Last audited:** 2026-08-13  
**Scope:** Website (`barbero`) + Mobile app (`barbero-app`)  
**Twin copy:** Keep this file in sync with `barbero/docs/GO_LIVE.md`.

## Status summary

Core marketplace loops (login → discover → book → cancel → messaging → role dashboards) are largely API-backed and usable for a **closed, invite-only beta**. The product is **not ready** for open public launch: no real payments, no outbound email, unfinished branding cutover, app store/production config gaps, and a committed SSH private key that must be rotated.

| Phase | Goal | Ready? |
| --- | --- | --- |
| Phase 1 — Soft launch | Invite-only beta, no Stripe | **Not yet** — close blockers below |
| Phase 2 — Full launch | Public signup + real money + store | **Blocked** until Phase 1 + items below |

---

## Phase 1 — Soft launch / invite-only beta

Invite-only users (admin-created accounts). No live card charging. Password reset and store/beta basics must still work.

### Blockers (must close)

- [ ] **[Shared]** Rotate and purge committed SSH key `apps/api-meteor/.deploy/Barbero.pem`; remove from git history; use CI secrets only
- [ ] **[Shared]** Wire outbound email (`MAIL_URL` / SMTP) for password reset; stop logging reset URLs as the only delivery path
- [ ] **[Shared]** Document launch as **invite-only** (no public signup yet)
- [ ] **[Shared]** Finish **Beru vs Barbero** naming cutover (metadata, titles, footers, logos) or freeze one brand for launch
- [ ] **[Shared]** Publish Privacy Policy + Terms URLs; link from web + app Account/Settings and store listings
- [ ] **[Website]** Remove or fix misleading UX: booking success “email sent”; premium FAQ payment claims
- [ ] **[Website]** Hide or gate admin “Reset mock data” / demo reseed in production (`BARBERO_ALLOW_DEMO_RESEED`)
- [ ] **[Website]** Confirm production env: Vercel `METEOR_API_URL`, same-origin `/meteor-api`, `wss://` DDP, Mup `WEB_ORIGIN`, strong admin password (no `change-me-*`)
- [ ] **[App]** Point production builds at HTTPS API (`EXPO_PUBLIC_API_URL`); stop relying on localhost
- [ ] **[App]** Disable Android cleartext for production/store builds (`usesCleartextTraffic: true` in `app.json`)
- [ ] **[App]** Fill Google Maps API keys (empty in `app.json` / `.env.example`)
- [ ] **[App]** Add iOS `buildNumber`; wire EAS production credentials and real `eas submit`
- [ ] **[App]** Hide or relabel Payments stub so users are not told cards work
- [ ] **[App]** Run and pass README smoke checklist; capture store-ready screenshots for beta/listing

### Website

- [ ] Password-reset email actually delivered (not console-only) — `apps/api-meteor` password-reset + `docs/production-env.md`
- [ ] Booking confirmation copy does not claim email was sent until mailer exists — `apps/web/app/book/[slug]/page.tsx`
- [ ] Premium / marketing copy does not claim live card or PayPal checkout — `apps/web/app/premium/page.tsx`
- [ ] Account sidebar uses real avatar (or initials), not stock Unsplash — `apps/web/components/account-sidebar.tsx`
- [ ] Footer year / brand name consistent with launch brand — landing, premium, provider pages
- [ ] Commit intentional Beru logo/video assets; align `layout.tsx` metadata with brand
- [ ] Seed / admin passwords changed from `change-me-*` in production settings

### Mobile app

- [ ] Production EAS env secrets for API URL and Maps keys
- [ ] Privacy + Terms links in Account/Settings
- [ ] Store listing metadata (privacy URL, age rating, contact) prepared for TestFlight / internal testing track
- [ ] Password-reset UX documented for beta (manual token paste OK for soft launch; deep link later)
- [ ] `__DEV__` seed quick-fill remains dev-only on login

### Shared / backend / ops

- [ ] Invite-only ops runbook: how admins create customers/providers
- [ ] Production Mongo / Meteor / Vercel health check after deploy
- [ ] Ensure `.gitignore` covers `*.pem` and key is not re-committed
- [ ] Add `MAIL_URL` (or SMTP vars) to production env examples — web + API `.env.production.example`

---

## Phase 2 — Full public launch

Open signup, real payments, real notifications, store submission.

### Website

- [ ] Public customer signup / register page (and optional provider onboarding)
- [ ] Stripe (or equivalent) for booking checkout and/or Pro subscription
- [ ] Remove fake payment methods (last4-only), synthetic `$50` revenue, and free Pro plan flip from customer-facing money paths
- [ ] Booking confirmation + transactional emails wired end-to-end
- [ ] Public `/privacy` and `/terms` pages (if not already hosted elsewhere)
- [ ] Reschedule flow complete (`?reschedule=` honored on book page)
- [ ] Real unread message counts (not always `0`) — conversations queries
- [ ] Media upload for portfolio (not URL-paste only)
- [ ] Delete dead mock libs: `apps/web/lib/mock-data.ts`, `customer-mock-data.ts`, `admin-mock-data.ts`, `admin-users-session.ts`
- [ ] CI: add lint / typecheck / web build (not only API + E2E)
- [ ] Refresh stale docs (`implementation-tracker.md`, `feature-specs.md`, roadmap dates)

### Mobile app

- [ ] Public signup screen (or clear “sign up on web” CTA)
- [ ] Real Stripe payments UI (replace `account/payments` stub) if charging in-app
- [ ] Real push notifications (`expo-notifications`); replace `src/utils/pushPlaceholder.ts`
- [ ] Notification preference toggles in Settings
- [ ] Wire booking notes from UI → `createBooking` API + types
- [ ] Customer write-review after completed booking
- [ ] Chat image attach (today logs only) — `MessageThreadView`
- [ ] Deep-link password reset via `barbero://` scheme
- [ ] Guest discovery without login **or** update roadmap claim
- [ ] EAS: production build-on-tag + iOS/Android submit workflows
- [ ] Native camera/gallery for portfolio/avatar (if URL-paste is insufficient)

### Shared / monetization / compliance

- [ ] Stripe keys + webhooks documented in production env
- [ ] Payment history and admin revenue derived from real charges
- [ ] App Store / Play privacy questionnaires and data-safety forms
- [ ] Confirm OSM / Maps tile usage complies with provider ToS for production traffic
- [ ] Automated regression coverage expanded (admin mutations, account/dashboard E2E; app tests if desired)

---

## Already good enough for closed beta

Do not re-build these for soft launch:

- Login, cookie/session auth, role middleware, lockout, logout revoke
- Discovery, provider pages, map browse (with keys filled)
- Book create, list, detail, cancel / provider status updates
- Messaging (text threads)
- Customer `/account/*`, provider `/dashboard/*`, admin CRUD (ops)
- App auth session, customer + provider booking loops, provider workspace
- App icons / splash assets present; EAS project id and preview CI typecheck exist

---

## Notes

- Feature roadmaps and trackers (may be stale vs this checklist):
  - Website: `barbero/docs/roadmap.md`, `barbero/docs/implementation-tracker.md`, `barbero/docs/production-env.md`
  - App: [`docs/roadmap.md`](./roadmap.md), [`docs/implementation-tracker.md`](./implementation-tracker.md), [`README.md`](../README.md) smoke checklist
- Re-audit before each launch gate; bump **Last audited** at the top of this file.
- Soft launch default: **invite-only, no Stripe**. Full launch requires Phase 2 payments + signup.
