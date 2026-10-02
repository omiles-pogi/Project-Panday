# Project-Panday Mobile

React Native (Expo Router) port of the Project-Panday web app. Independent Expo project — its
own `package.json`/`node_modules`, not an npm workspace with the sibling `backend/`
project. It talks to the same Laravel backend over HTTP.

## Project structure

```
src/
  app/          Expo Router routes (file-based) — thin, mostly re-export a screen
  screens/      Actual screen implementations
  components/   Shared UI building blocks (BriefPrompt, ComingSoon, drawer content, ...)
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

Then set `frontend/.env`'s `EXPO_PUBLIC_API_BASE_URL` to your machine's **LAN IP**
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

## What's built vs. stubbed

Only the **homeowner** role is fully wired up: real registration/login (Sanctum
token auth), the bottom-tab + drawer navigation shell, and the AI planner flow end to
end (`ProjectChat` → `PlanContext` → `/api/ai/plan`, plus `BudgetGenerator` and
`MaterialEstimator` reading the same generated plan). The **contractor** and **worker**
roles have full tab-based UIs ported from the web app (`src/screens/contractor`,
`src/screens/worker`) running on static sample data in `src/data/` — there is no
contractor/worker backend API yet. Supplier lands on a placeholder screen after login
(with a working sign-out), and several homeowner
screens (Progress Monitor, Budget Monitor, Labor/Equipment Estimator, AI Design,
Approvals, Contractor Marketplace, Expenses) show a "hasn't been ported yet" stub —
see the project's port plan for the full checklist of what's left.

## Known, intentional oddities

- **`tailwindcss` is pinned to v3** here, even though the web app (`resources/css/app.css`)
  uses Tailwind v4. NativeWind 4.x's underlying engine (`react-native-css-interop`)
  only supports Tailwind v3 — this is unrelated to NativeWind's own major version
  number. Don't "fix" this by upgrading to v4; it'll break the Metro build.
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
