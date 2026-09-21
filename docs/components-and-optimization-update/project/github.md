repo: evanoralph/barbero-app
branch: main

## Last sync

date: 2026-09-21T02:00:00Z

### Updated in this project
- Recreated Explore, Bookings (customer + provider) and Messages chrome from source styles.
- Added three filter patterns: sheet with count badge, inline panel, quick-chip rail.
- Added offline banner, stale badge, queued-action toast and full offline page.
- Added fetch states: card-shaped skeletons, dimmed refetch, paged loading, last-updated.

## Screen map

| Project screen | Repo files |
| --- | --- |
| Home (5a/5b) | app/(customer)/index.tsx, src/components/ProviderCard.tsx, src/components/BrandLogo.tsx, src/api/categories.ts |
| Booking detail (4a/4b) | app/(customer)/bookings/[id].tsx, src/components/BookingDetailView.tsx, src/utils/bookingDisplay.ts |
| Artist profile (3a/3b) | app/(customer)/provider/[slug].tsx, src/components/ProviderProfileView.tsx |
| Map (2a/2b) | app/(customer)/map.tsx, src/components/ProvidersMapView.tsx, app/(customer)/search.tsx |
| Explore (1a/1b/1c) | app/(customer)/search.tsx, src/components/ProviderCard.tsx, src/components/ui.tsx, src/api/providers.ts |
| Customer bookings (1d left) | app/(customer)/bookings/index.tsx, src/components/BookingCard.tsx, src/utils/bookingDisplay.ts |
| Provider bookings (1d right) | app/(provider)/bookings/index.tsx, app/(provider)/_layout.tsx, src/utils/bookingDisplay.ts, src/utils/format.ts |
| Messages inbox (1e) | src/components/MessagesInbox.tsx, src/components/ConversationRow.tsx |
| Offline states (1f) | app/server-down.tsx, src/server/server-status.tsx, src/api/client.ts, src/components/BrandLogo.tsx |
| Fetching states (1g) | src/api/client.ts, src/components/ui.tsx, app/(customer)/search.tsx |
| Tab chrome (all) | app/(customer)/_layout.tsx, src/components/TabIcon.tsx, src/theme/colors.ts, src/theme/fonts.ts |
