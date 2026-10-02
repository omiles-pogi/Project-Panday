# Project-Panday

AI-powered construction management for homeowners, contractors, suppliers, and
workers. Three sibling projects, each independently run:

- **`backend/`** — Laravel API + the web React/Vite/Tailwind app (Laravel serves it
  directly via Vite integration, not a separate deployable). See `backend/AGENTS.md`.
- **`frontend/`** — Expo/React Native mobile app, calls the backend's JSON API over
  HTTP. See `frontend/AGENTS.md` and `frontend/README.md`.
- **`admin/`** — standalone web admin page (Vite + React): approve/reject new accounts and
  view analytics, talking to the backend's `/api/admin/*`. Single allowed account; see
  `admin/README.md`.

All client apps authenticate against the backend with Laravel Sanctum bearer tokens.
`admin`/`superadmin` roles exist for future admin tooling but are never
self-registerable — see `backend/AGENTS.md`'s "Auth & roles" section.
