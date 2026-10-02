# Project-Panday Admin (web)

Standalone web admin page. It approves or rejects new accounts and shows app
analytics. It is its own Vite + React + Tailwind app and talks to the Laravel API in
`../backend` over HTTP (`/api/admin/*`).

## Run

Start the backend first (from `backend/`):

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

Then, from this folder:

```bash
npm install
npm run dev
```

Open **http://localhost:5174**. In dev, Vite proxies `/api` to `http://localhost:8000`
(change with the `ADMIN_API_TARGET` env var), so no CORS setup is needed.

For a deployed build, set `VITE_API_BASE_URL` (e.g. `https://api.example.com`) and run
`npm run build`; the static output lands in `dist/`. Browsers will then need the
backend to allow this origin via CORS.

## Access

Only one account can use this page: the superadmin whose email matches `ADMIN_EMAIL`
in `backend/.env` (default `admin@panday.test`). The check is server-side in
`backend/app/Http/Middleware/EnsurePortalAdmin.php`; the credentials for the local dev
account are in the git-ignored `backend/.env.admin`. Create or re-promote a superadmin
with `php artisan make:superadmin` from `backend/`.

## Layout

- `src/AdminApp.tsx` — login, Accounts (approve/reject) and Analytics views
- `src/api.ts` — typed client for `/api/auth/login` and `/api/admin/*`
