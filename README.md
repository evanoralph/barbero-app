# Barbero Mobile (Expo)

React Native (Expo) client for **Barbero** — book beauty & grooming professionals.  
Talks to the existing Meteor API in the sibling monorepo [`../barbero`](../barbero).

**v1 roles:** Customer + Provider  
**Out of scope:** Admin (use web), Stripe live payments

Follow the phased work in [`docs/roadmap.md`](docs/roadmap.md) and track status in [`docs/implementation-tracker.md`](docs/implementation-tracker.md).

---

## Architecture

```
Expo app (this repo)
    │  Authorization: Bearer <meteor resume token>
    ▼
Meteor REST  /api/v1   (../barbero/apps/api-meteor)
    ▼
MongoDB
```

Web (`../barbero/apps/web`) and this mobile app share the same API. Mobile does **not** use Next.js cookie sessions.

---

## Prerequisites

- **Node.js** `^20.19.4` or `^22.13.0` or `^24.3.0+` (see `.nvmrc` — Node 21 is not supported; Expo uses `util.parseEnv`)
- npm or pnpm
- Expo Go (device) or iOS Simulator / Android Emulator
- Sibling API running from `../barbero` (port **4000**)

```bash
# if you use nvm
nvm use   # reads .nvmrc → 22.22.3
```

---

## Setup

```bash
cd barbero-app
npm install
cp .env.example .env
```

Edit `.env`:

```bash
# Simulator / emulator
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1

# Physical device: use your machine LAN IP, e.g.
# EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1
```

### Start the Meteor API (sibling repo)

```bash
cd ../barbero
pnpm install
pnpm dev:mongo   # optional but recommended
export MONGO_URL=mongodb://127.0.0.1:27017/meteor
pnpm dev:api
```

### Start the mobile app

```bash
cd barbero-app
npx expo start
```

Then press `i` (iOS), `a` (Android), or scan the QR code with Expo Go.

---

## How to follow the roadmap

1. Open [`docs/roadmap.md`](docs/roadmap.md) — work **Phase 0 → 6** in order.
2. Implement one task ID at a time (`RN0-01`, `RN1-01`, …).
3. Add logs for API calls and mutations via `src/utils/logger.ts`.
4. Mark the task done in the roadmap and in [`docs/implementation-tracker.md`](docs/implementation-tracker.md).
5. Keep loading / empty / error states on every screen you touch.
6. Do not break existing Meteor endpoints; mobile is a new client only.

---

## Module map

| Area | App routes | Source |
| --- | --- | --- |
| Auth | `app/(auth)/` | `src/auth/`, `src/api/auth.ts` |
| Customer tabs | `app/(customer)/` | discovery, bookings, messages, account |
| Provider tabs | `app/(provider)/` | dashboard, bookings, availability, profile |
| API client | — | `src/api/client.ts` + module files |
| Theme | — | `src/theme/` |
| Logger | — | `src/utils/logger.ts` |

---

## Seed test accounts

From `../barbero/apps/api-meteor/settings.development.json` (dev only):

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@example.test` | `change-me-customer-8chars` |
| Provider | `provider@example.test` | `change-me-provider-8chars` |
| Admin | `admin@example.test` | *(web only — mobile redirects away)* |

---

## Smoke checklist

- [ ] API health: app logs successful `GET /health` on launch
- [ ] Customer login → lands on Home
- [ ] Browse provider → open profile → Book → booking appears in Bookings
- [ ] Customer Messages: open/send in a thread
- [ ] Customer Account: edit name, see Saved
- [ ] Provider login → Dashboard KPIs load
- [ ] Provider: confirm/cancel a booking
- [ ] Provider: save availability
- [ ] Logout returns to login; relaunch restores session when token valid

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Device cannot reach API | Use LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost` |
| 401 on authenticated calls | Token missing/expired — log in again; check Bearer header logs |
| CORS | Meteor REST allows Authorization; if blocked, confirm you hit Meteor `:4000`, not Next.js |
| Admin login | Mobile v1 does not support admin — use web `/admin` |

---

## EAS builds

Profiles live in `eas.json` (`development`, `preview`, `production`).  
Install EAS CLI and run `eas build --profile preview` when ready.
