# Project-Panday

AI-powered construction management for homeowners, contractors, suppliers, and
workers. Three sibling projects:

```
backend/    Laravel API + the web React/Vite/Tailwind app
frontend/   Expo/React Native mobile app (calls backend/'s API over HTTP)
admin/      reserved for a future admin dashboard — not built yet
```

## Running it

**Backend** (Laravel API + web app):

```bash
cd backend
php artisan serve   # http://localhost:8000
npm run dev          # Vite dev server for React/HMR, http://localhost:5173
```

Bind to `--host=0.0.0.0` instead of the default if you need the mobile app (on a phone
or emulator) to reach it — see `frontend/README.md` for details.

**Mobile app**:

```bash
cd frontend
npx expo start
```

Scan the QR code with Expo Go. Set `frontend/.env`'s `EXPO_PUBLIC_API_BASE_URL` to the
backend's LAN IP first — see `frontend/README.md`.

## Roles & admin access

Public registration only allows `homeowner`/`contractor`/`supplier`/`worker`. Create the
first superadmin from `backend/`:

```bash
php artisan make:superadmin {name} {email} {password}
```

See `backend/AGENTS.md`'s "Auth & roles" section for details.
