# Barbero Mobile (Expo) Delivery Roadmap

**Stack:** Expo + React Native + TypeScript in `barbero-app/`  
**Backend:** Meteor REST `../barbero` → `/api/v1` (Bearer resume token)  
**Roles in v1:** Customer + Provider (Admin stays web-only)

**Status legend:** `[ ]` not started · `[~]` partial · `[x]` done

**Definition of done (per task):**

1. Behavior matches the API contracts used by the web app.
2. Status updated in `docs/implementation-tracker.md`.
3. Logs added for API calls and important mutations (`src/utils/logger.ts`).
4. No regression on existing auth/booking paths (mobile only; do not break Meteor API).
5. Loading, empty, and error UI states handled on screens touched.

Work top-to-bottom within each phase. Later phases assume earlier foundations exist.

---

## Phase 0 — Foundation

**Goal:** Runnable Expo app with API client, secure session, role layouts, docs.

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN0-01 | Scaffold Expo (TypeScript, Expo Router) | — | [x] |
| RN0-02 | Env: `EXPO_PUBLIC_API_URL` + `.env.example` | RN0-01 | [x] |
| RN0-03 | API client (fetch wrapper, Bearer header, error mapping) | RN0-02 | [x] |
| RN0-04 | Secure token storage (`expo-secure-store`) | RN0-03 | [x] |
| RN0-05 | Logger utility (dev-gated) + logs on API/auth | RN0-03 | [x] |
| RN0-06 | Role gate layouts: `(auth)`, `(customer)`, `(provider)` | RN0-04 | [x] |
| RN0-07 | README + implementation tracker | — | [x] |

**Exit:** App boots, can hit `/health`, redirects by role when a token exists.

---

## Phase 1 — Auth

**Goal:** Login, session restore, logout, password reset.

**Screens:** `(auth)/login`, `(auth)/forgot-password`, `(auth)/reset-password`  
**API:** `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN1-01 | Login screen (email/password) | RN0-06 | [x] |
| RN1-02 | Persist token + restore session via `/auth/me` on launch | RN1-01 | [x] |
| RN1-03 | Logout clears token and returns to login | RN1-02 | [x] |
| RN1-04 | Forgot password screen | RN1-01 | [x] |
| RN1-05 | Reset password screen (token + new password) | RN1-04 | [x] |
| RN1-06 | Loading / error / locked-account states | RN1-01 | [x] |

**Exit:** Seed customer/provider can log in and land on the correct stack.

---

## Phase 2 — Customer discovery

**Goal:** Browse categories, search providers, open profile, favorites, map.

**Screens:** home, search, `provider/[slug]`, map, favorites affordance  
**API:** `GET /categories`, `GET /providers`, `GET /providers/:slug`, `GET /providers/:slug/reviews`, `GET /providers/map`, favorites

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN2-01 | Home: categories + featured providers | RN1-02 | [x] |
| RN2-02 | Search with category / q / sort filters | RN2-01 | [x] |
| RN2-03 | Provider profile (services, reviews, CTA book) | RN2-01 | [x] |
| RN2-04 | Favorites toggle (add/remove) | RN2-03 | [x] |
| RN2-05 | Map markers list (from `/providers/map`) | RN2-01 | [x] |

**Exit:** Guest/customer can discover a provider end-to-end.

---

## Phase 3 — Customer bookings (core loop)

**Goal:** Book appointment → see it in list/detail.

**Screens:** `book/[slug]`, bookings list, booking detail  
**API:** `GET /providers/:slug/slots?date=`, `POST /bookings`, `GET /bookings`, `GET/PATCH /bookings/:id`

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN3-01 | Book flow: service → date → slot → confirm | RN2-03 | [x] |
| RN3-02 | Bookings list (customer-scoped) | RN3-01 | [x] |
| RN3-03 | Booking detail + cancel (status PATCH) | RN3-02 | [x] |
| RN3-04 | Logs on create/cancel; loading/error/success | RN3-01 | [x] |

**Exit:** Login → discover → book → appears in bookings list.

---

## Phase 4 — Customer messaging + account

**Goal:** Threads + account management.

**Screens:** messages list, thread, account overview, settings, saved  
**API:** `GET /conversations`, `GET/POST /messages`, `GET/PATCH /account/me`, favorites list

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN4-01 | Conversations list | RN1-02 | [x] |
| RN4-02 | Thread view + send message | RN4-01 | [x] |
| RN4-03 | Start thread from provider profile | RN4-02 | [x] |
| RN4-04 | Account overview | RN1-02 | [x] |
| RN4-05 | Settings / profile edit | RN4-04 | [x] |
| RN4-06 | Saved providers screen | RN2-04 | [x] |
| RN4-07 | Payment methods UI stub (Stripe deferred) | RN4-04 | [x] |

**Exit:** Customer can message a provider and edit profile.

---

## Phase 5 — Provider workspace

**Goal:** Provider can manage bookings, availability, profile, inbox, plan.

**Screens:** dashboard, bookings, availability, messages, profile, subscription  
**API:** `/providers/me`, `/providers/me/availability`, `/providers/me/analytics`, `/providers/me/subscription`, bookings PATCH, conversations

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN5-01 | Dashboard KPIs from analytics API | RN1-02 | [x] |
| RN5-02 | Provider bookings list + status PATCH | RN5-01 | [x] |
| RN5-03 | Availability editor (weekly + overrides summary) | RN5-01 | [x] |
| RN5-04 | Provider profile edit (`PATCH /providers/me`) | RN5-01 | [x] |
| RN5-05 | Provider messages inbox (reuse messaging) | RN4-02 | [x] |
| RN5-06 | Subscription / plan screen | RN5-01 | [x] |

**Exit:** Seed provider can confirm a booking and update availability.

---

## Phase 6 — Polish + release readiness

**Goal:** Production-minded UX and build profiles.

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN6-01 | Pull-to-refresh + empty/error states audit | RN3–RN5 | [x] |
| RN6-02 | Push notifications placeholder (register token stub) | RN0-01 | [x] |
| RN6-03 | EAS build profiles (`eas.json`: development, preview, production) | RN0-01 | [x] |
| RN6-04 | Smoke checklist in README | RN6-03 | [x] |
| RN6-05 | One-line pointer from monorepo `barbero/README.md` to mobile app | RN6-04 | [x] |

**Exit:** Documented smoke path; EAS profiles ready for builds.

---

## Phase 7 — Provider profile depth

**Goal:** Providers can manage the fields customers already see (services, portfolio, location, media URLs).

**Screens:** `(provider)/profile` (expanded)  
**API:** `GET/PATCH /providers/me` (`bio`, `responseTime`, `avatar`, `coverImage`, `location`, service + portfolio ops)

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN7-01 | Location + avatar/cover URL fields on profile save | RN5-04 | [x] |
| RN7-02 | Services list + add/edit/remove via PATCH | RN7-01 | [x] |
| RN7-03 | Portfolio list + add/edit/remove (image URL) via PATCH | RN7-01 | [x] |
| RN7-04 | Logs + loading/empty/error states on mutations | RN7-02 | [x] |
| RN7-05 | Update tracker when RN7 ships | RN7-04 | [x] |

**Exit:** Seed provider can add a service and portfolio item from mobile; customers see them on public profile.

**Deferred:** promotions CRUD, native camera/gallery upload.

---

## Phase 8 — Provider hardening & parity

**Goal:** Harden provider workspace against incomplete API payloads, fix availability slot compatibility, and close the largest gaps vs the web provider dashboard.

**Screens:** dashboard, availability, bookings, analytics (extend), profile, subscription, inbox  
**API:** existing `/providers/me/*`, bookings, reviews, availability (no Meteor API changes required for RN8-01/02)

| ID | Task | Depends | Status |
| --- | --- | --- | --- |
| RN8-01 | Safe numeric display for `averageRating` / `rating` (dashboard + customer surfaces) | RN5-01 | [x] |
| RN8-02 | Availability default times use AM/PM labels (`09:00 AM` / `05:00 PM`) | RN5-03 | [x] |
| RN8-03 | Sync mobile `ProviderAnalytics` (+ related types) with shared contract fields | RN8-01 | [x] |
| RN8-04 | Availability range editor (start/end, add/remove ranges) | RN8-02 | [x] |
| RN8-05 | Calendar overrides editor | RN8-04 | [x] |
| RN8-06 | Booking detail customer enrichment + tappable upcoming on dashboard | RN5-02 | [x] |
| RN8-07 | Bookings tabs/filters + pagination | RN8-06 | [x] |
| RN8-08 | Analytics range picker + extended KPIs | RN8-03 | [x] |
| RN8-09 | Provider reviews list | RN5-01 | [x] |
| RN8-10 | Profile: lat/lng, image previews, view public profile | RN7-01 | [x] |
| RN8-11 | Promotions CRUD | RN7-02 | [x] |
| RN8-12 | Subscription monthly/yearly + renewal display | RN5-06 | [x] |
| RN8-13 | Inbox polish (unread, avatars) | RN5-05 | [x] |
| RN8-14 | Dashboard polish (completeness, performance summary) | RN8-08 | [x] |

**Exit:** Provider login never crashes on missing ratings; enabling hours produces bookable slots; clear backlog for web-parity follow-ups.

---

## How to follow this roadmap

1. Pick the next unchecked task in the current phase.
2. Implement with logs on API/auth/mutations.
3. Mark the task `[x]` here and update `implementation-tracker.md`.
4. Do not start Admin mobile work in v1.
5. Prefer small vertical slices (screen + API client + states) over large refactors.
