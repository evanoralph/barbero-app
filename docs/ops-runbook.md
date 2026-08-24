# Operations Runbook (Mobile)

**Last updated:** 2026-08-21  
**Twin copy:** See also `barbero/docs/ops-runbook.md` for API/web.

## Pre-release checklist

1. Set EAS secrets: `EXPO_PUBLIC_API_URL` (HTTPS), optional `EXPO_PUBLIC_API_DDP_URL` (WSS).
2. Set Maps keys: `EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`.
3. Set legal URLs: `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`.
4. Run `npm run typecheck` and build preview APK/IPA.
5. Complete README smoke checklist on a device against staging API.

## Production EAS env (set in Expo dashboard)

| Variable | Expected production value |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | `https://api.beru.digital/api/v1` |
| `EXPO_PUBLIC_API_DDP_URL` | `wss://api.beru.digital/websocket` (optional; derived if unset) |
| `EXPO_PUBLIC_PRIVACY_URL` | Your published privacy page URL |
| `EXPO_PUBLIC_TERMS_URL` | Your published terms page URL |

Maps keys are still optional (map tiles may be limited until added).

`eas.json` submit profile:

- `appleId`: `evanoralph@gmail.com`
- `appleTeamId`: `9445NHCXCU` (Ralph Evano)
- `ascAppId`: `6803501085` (Beru / `com.beruapp.ai`)

Confirm EAS production env matches the table above before every store/TestFlight build:

```bash
eas env:list --environment production
# If needed:
# eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.beru.digital/api/v1 --visibility plaintext
```

## TestFlight (manual Apple login)

Run these in a **local terminal** (interactive — EAS will prompt for Apple ID / 2FA):

```bash
cd barbero-app
nvm use
npm run typecheck

# 1) App Store Connect app already exists (com.beruapp.ai / ASC 6803501085)

# 2) Link Apple credentials (Distribution cert + App Store profile) if needed
npm run eas:ios:credentials
# Choose: production profile → Log in to Apple → Let EAS manage credentials

# 3) Production iOS build
npm run eas:ios:production

# 4) After build finishes → TestFlight
npm run eas:ios:submit
```

Then in App Store Connect → TestFlight: wait for processing, answer export compliance if asked (`ITSAppUsesNonExemptEncryption` is already `false`), add internal testers (group **Team**).

## Automated path

```bash
# Full production: Android Play internal + iOS TestFlight (on git tag)
git tag v1.0.0 && git push origin v1.0.0
# or: npm run eas:production

# TestFlight only (no tag required)
npm run eas:testflight
```

Workflows:

- [`.eas/workflows/production.yml`](../.eas/workflows/production.yml) — tag `v*` → typecheck → Android + iOS production builds → Play submit + TestFlight
- [`.eas/workflows/testflight.yml`](../.eas/workflows/testflight.yml) — manual → typecheck → iOS production → TestFlight (`Team` group)

## Rollback

- **Internal track:** promote previous build in Play Console / TestFlight.
- **Do not** ship a production build without HTTPS API URL (enforced in `src/utils/production.ts`).

## Push notifications

- Production builds register Expo push tokens via `src/utils/push.ts`.
- Backend token storage/delivery is still required for real notifications (Phase 2).

## Support

- In-app: Settings → Privacy / Terms links.
- Email: `support@beru.app` (replace before public launch).
