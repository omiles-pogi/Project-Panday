# Project-Panday Mobile

React Native (Expo Router) port of the Project-Panday web app. Independent Expo project — its
own `package.json`/`node_modules`, not an npm workspace with the sibling `backend/`
project. It talks to the same Laravel backend over HTTP.

## Project structure

```
src/
  app/          Expo Router routes (file-based) — thin, mostly re-export a screen
  screens/      Actual screen implementations
  components/   Shared UI building blocks (BriefPrompt, SupplierPicker, drawer content, ...)
  context/      AuthContext, PlanContext — app-wide state
  services/     API calls: services/api (auth/client), services/ai (plan generation)
  types/        Shared TS types (types/auth.ts, types/plan.ts)
  validators/   Form validation (validators/auth.ts) — client-side pre-checks only,
                the backend's Form Requests are the source of truth
  utils/        Small pure helpers (currency formatting, chart color rotation)
  theme/        Color palette + fonts, mirrors the web app's CSS variables
```

Keep screens thin: form validation goes in `validators/`, API calls go in `services/`,
shared types go in `types/` — the same layering convention as the backend
(`backend/AGENTS.md`'s "Architecture convention").

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # then edit EXPO_PUBLIC_API_BASE_URL, see below
npx expo start
```

Scan the QR code with **Expo Go** on a physical device, on the same Wi-Fi as your dev
machine.

## Backend

The Laravel API must be reachable from your phone/emulator, so `localhost` won't work —
a phone has its own network namespace. Start Laravel bound to all interfaces:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

**In development you don't need to chase your IP:** the app takes the PC's address from the Expo
dev server it loaded from and talks to the API on port 8000 of that same machine (see
`resolveBaseUrl` in `src/services/api/client.ts`), so a router handing the PC a new IP no longer
breaks it. `EXPO_PUBLIC_API_BASE_URL` is then only the fallback — for standalone builds and tunnel
mode, where that address isn't available. If you want to set it anyway, use your machine's **LAN IP**
(`ipconfig` on Windows), e.g. `http://192.168.1.23:8000`. Restart `expo start` after
changing `.env` (Expo only reads it at boot).

- **Physical device via Expo Go** (recommended, simplest): LAN IP as above.
- **Android emulator**: use `http://10.0.2.2:8000` instead — that's the emulator's
  special alias for the host machine's `localhost`, not your LAN IP.
- **iOS simulator**: can reach the host's `localhost` directly, unlike Android.

Run migrations (Sanctum tables + the `role` column) and make sure
`ANTHROPIC_API_KEY` is set in the Laravel `.env` before generating a plan:

```bash
php artisan migrate
```

## What each role can do

Every screen runs on the real backend — there is no sample-data screen left in the app.

- **Homeowner** — AI planner chat (`ProjectChat` → `PlanContext` → `/api/ai/plan`) that builds a
  timeline, budget and materials, with a supplier picker per category; project dashboard with "not
  started yet" projects and the project calendar (AI-proposed schedule vs actual progress); Progress,
  Budget Monitor (with the team on site, and the plan and budget as a PDF), Find Your Team, Material
  Approvals, Supplier Catalog, Supplier Quotes (ask suppliers to bid, compare, award), Messages, and a
  private Profile (location, contact number, project counts).
- **Contractor** — browse and apply to projects, My Projects (the checklist, with Check All / Uncheck All on each phase and
  "Mark Project as Finished" at the bottom, which sends it to the homeowner to confirm or send back; plus the team's
  attendance and daily logs), a dashboard with each project's calendar, Material Requests (draft → homeowner approval → supplier
  orders, exportable as a PDF), Supplier Materials, Supplier Quotes, Messages, Profile.
- **Worker** — a dashboard that holds Attendance (check in / out), the Daily Work Log and Earnings (days worked ×
  day rate) next to the assignments, plus browse and apply to projects, skills profile, Messages.
- **Supplier** — dashboard, inventory (listings and stock), material orders (confirm / decline / deliver), Bid
  Requests (price a homeowner's or contractor's material list), and a shop Profile (location, contact number,
  about — shown to buyers on the catalog).

**PDF export** is built on the phone (`src/utils/pdf.ts`, `expo-print` + `expo-sharing`) and works in Expo Go.

**Push notifications** (`src/services/push.ts`) reach the phone with the app closed, on top of the in-app bell and
pop-up. They need a real build (the Android APK, or a development build) with an Expo project behind it: run
`npx eas-cli init` so `app.json` gets `extra.eas.projectId`, and give EAS your Firebase (FCM) credentials for
Android. **Expo Go can't receive them** — there the code does nothing, and the in-app notifications are unaffected.

`src/data/` only holds display constants now (inventory types and colours, the PandAi tour text).

## Known, intentional oddities

- **`tailwindcss` is pinned to v3** here, even though the web app (`resources/css/app.css`)
  uses Tailwind v4. NativeWind 4.x's underlying engine (`react-native-css-interop`)
  only supports Tailwind v3 — this is unrelated to NativeWind's own major version
  number. Don't "fix" this by upgrading to v4; it'll break the Metro build.
- **`index.js` is the app's entry** (`package.json` `main`), and all it does besides loading
  `expo-router/entry` is hide one warning, "ImageBackground is deprecated". That comes from
  `react-native-css-interop` (NativeWind), which reads `ImageBackground` on startup although no screen
  uses it. It fires before any screen renders, so it can't be silenced from a layout file. Drop `index.js`
  and point `main` back at `expo-router/entry` once NativeWind stops touching `ImageBackground`.
- Some installs here needed `--legacy-peer-deps` because `expo`'s optional web support
  wants `react-dom`, which isn't otherwise pulled in for a mobile-only app. `react-dom`
  is pinned as a plain dependency (matching `react`'s version) specifically to keep
  peer resolution clean for *future* installs — it isn't used by any app code.
- `expo-doctor` may still note a duplicate React somewhere on disk (the web app's own
  `backend/node_modules/react`) — harmless. `backend/` is a sibling of `frontend/`, not
  an ancestor, so Node/Metro's hierarchical module resolution walking up from
  `frontend/` never reaches it; only `frontend/node_modules/react` is ever resolved.
  Don't add a custom Metro resolver override for this (`disableHierarchicalLookup` was
  tried once and broke resolution of Expo's own packages like `@expo/metro-runtime`).

## Auth notes

Sanctum tokens issued by `/api/auth/login` and `/api/auth/register` don't expire by
default (no refresh flow exists). The token is stored in `expo-secure-store`, not
`AsyncStorage`, since it's a credential.

## Install it on a phone as a real app (Android APK)

`npx expo start` + Expo Go is the quick way to try changes. To get an installable app with its own
icon — no Expo Go and no dev server running — build an APK in Expo's cloud:

```bash
npx eas-cli login                                  # free Expo account, one time
npx eas-cli build -p android --profile preview     # ~10-20 min; say yes to creating the project/keystore
```

When it finishes, open the build's link on the phone (or scan its QR) and install the `.apk`
(allow "install unknown apps" for your browser when asked).

- The app's backend address is baked in at build time from `eas.json`
  (`build.preview.env.EXPO_PUBLIC_API_BASE_URL`; the local `.env` is not used by cloud builds). It must be
  your PC's LAN IP, and the phone must be on the same Wi-Fi with `php artisan serve --host=0.0.0.0 --port=8000`
  running. If your PC's IP changes, update that value and rebuild.
- `usesCleartextTraffic` is enabled in `app.json` (via `expo-build-properties`) because release Android
  builds otherwise refuse the plain `http://` Laravel dev server. Remove it once the API is on HTTPS.
