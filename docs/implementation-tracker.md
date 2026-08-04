# Barbero Mobile — Implementation Tracker

**Last updated:** 2026-08-04  
**Source of tasks:** `docs/roadmap.md`

| Phase | Module | Status | Notes |
| --- | --- | --- | --- |
| RN0 | Foundation | [x] | Expo scaffold, API client, auth shell, docs |
| RN1 | Auth | [x] | Login, session, logout, forgot/reset |
| RN2 | Customer discovery | [x] | Home, search, profile, favorites, map list; Explore List/Map toggle + website-parity map pins |
| RN3 | Customer bookings | [x] | Book flow, list, detail/cancel |
| RN4 | Messaging + account | [x] | Per-booking threads, settings, saved, payments stub |
| RN5 | Provider workspace | [x] | Dashboard, bookings, availability, plan |
| RN6 | Polish + release | [x] | Refresh/empty states, push stub, EAS, smoke checklist |
| RN7 | Provider profile depth | [x] | Location, media URLs, services, portfolio CRUD |
| RN8 | Provider hardening & parity | [x] | RN8-01–14 complete |

## Quick checklist by phase

### RN0 Foundation
- [x] RN0-01 Scaffold
- [x] RN0-02 Env
- [x] RN0-03 API client
- [x] RN0-04 Secure store
- [x] RN0-05 Logger
- [x] RN0-06 Role layouts
- [x] RN0-07 Docs

### RN1 Auth
- [x] RN1-01 Login
- [x] RN1-02 Session restore
- [x] RN1-03 Logout
- [x] RN1-04 Forgot password
- [x] RN1-05 Reset password
- [x] RN1-06 Auth UI states

### RN2 Discovery
- [x] RN2-01 Home
- [x] RN2-02 Search
- [x] RN2-03 Provider profile
- [x] RN2-04 Favorites
- [x] RN2-05 Map
- [x] RN2-05b Explore map parity (List/Map toggle, avatar pins, selection card, shared ProvidersMapView)

### RN3 Bookings
- [x] RN3-01 Book flow
- [x] RN3-02 List
- [x] RN3-03 Detail/cancel
- [x] RN3-04 Logs + states

### RN4 Messaging + account
- [x] RN4-01 Conversations
- [x] RN4-02 Thread
- [x] RN4-03 Start from booking (no open profile DM)
- [x] RN4-04 Account overview
- [x] RN4-05 Settings
- [x] RN4-06 Saved
- [x] RN4-07 Payments stub

### RN5 Provider
- [x] RN5-01 Dashboard
- [x] RN5-02 Bookings
- [x] RN5-03 Availability
- [x] RN5-04 Profile edit
- [x] RN5-05 Messages
- [x] RN5-06 Subscription

### RN6 Polish
- [x] RN6-01 Refresh/empty/error audit
- [x] RN6-02 Push placeholder
- [x] RN6-03 EAS profiles
- [x] RN6-04 Smoke checklist
- [x] RN6-05 Monorepo README link

### RN7 Provider profile depth
- [x] RN7-01 Location + avatar/cover URLs
- [x] RN7-02 Services CRUD
- [x] RN7-03 Portfolio CRUD
- [x] RN7-04 Logs + UI states
- [x] RN7-05 Tracker sync

### RN8 Provider hardening & parity
- [x] RN8-01 Safe numeric display (`averageRating` / `rating`)
- [x] RN8-02 Availability default times use AM/PM labels
- [x] RN8-03 Sync `ProviderAnalytics` types with shared contracts
- [x] RN8-04 Availability range editor
- [x] RN8-05 Calendar overrides editor
- [x] RN8-06 Booking detail enrichment + tappable upcoming
- [x] RN8-07 Bookings tabs/filters + pagination
- [x] RN8-08 Analytics range picker + extended KPIs
- [x] RN8-09 Provider reviews list
- [x] RN8-10 Profile lat/lng, previews, public profile link
- [x] RN8-11 Promotions CRUD
- [x] RN8-12 Subscription monthly/yearly + renewal
- [x] RN8-13 Inbox polish
- [x] RN8-14 Dashboard polish
