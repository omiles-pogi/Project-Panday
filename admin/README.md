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

## Cloudflare Tunnel (admin.pandaydomain.com)

The admin is served from this PC through a Cloudflare Tunnel. `npm run preview` serves
the built files on port 5174 and proxies `/api` to Laravel, so the public site is a
single origin (no CORS, no `VITE_API_BASE_URL`).

One-time setup (needs `cloudflared`: `winget install Cloudflare.cloudflared`):

```bash
cloudflared tunnel login                                   # pick the pandaydomain.com zone
cloudflared tunnel create panday-admin
cloudflared tunnel route dns panday-admin admin.pandaydomain.com
```

Then write `~/.cloudflared/config.yml` (use the tunnel ID printed by `create`):

```yaml
tunnel: panday-admin
credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: admin.pandaydomain.com
    service: http://localhost:5174
  - service: http_status:404
```

Each time you want it online, run these three (separate terminals):

```bash
php artisan serve --host=0.0.0.0 --port=8000   # in backend/
npm run build && npm run preview               # in admin/
cloudflared tunnel run panday-admin
```

The site is only up while all three are running. Allowed hostnames are listed in
`vite.config.ts` (`allowedHosts`).

## Access

Only one account can use this page: the superadmin whose email matches `ADMIN_EMAIL`
in `backend/.env` (default `admin@panday.test`). The check is server-side in
`backend/app/Http/Middleware/EnsurePortalAdmin.php`; the credentials for the local dev
account are in the git-ignored `backend/.env.admin`. Create or re-promote a superadmin
with `php artisan make:superadmin` from `backend/`.

## Layout

- `src/AdminApp.tsx` — login, Accounts (approve/reject) and Analytics views
- `src/api.ts` — typed client for `/api/auth/login` and `/api/admin/*`
