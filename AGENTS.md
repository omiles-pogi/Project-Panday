# Project-Panday

AI-powered construction management for homeowners, contractors, suppliers, and
workers. Three sibling projects, each independently run:

- **`backend/`** — Laravel API + the web React/Vite/Tailwind app (Laravel serves it
  directly via Vite integration, not a separate deployable). See `backend/AGENTS.md`.
- **`frontend/`** — Expo/React Native mobile app, calls the backend's JSON API over
  HTTP. See `frontend/AGENTS.md` and `frontend/README.md`.
- **`admin/`** — reserved for a future admin dashboard. Not built yet; see
  `admin/README.md`.

All client apps authenticate against the backend with Laravel Sanctum bearer tokens.
`admin`/`superadmin` roles exist for future admin tooling but are never
self-registerable — see `backend/AGENTS.md`'s "Auth & roles" section.
