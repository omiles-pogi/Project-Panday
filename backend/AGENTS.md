# Project-Panday backend

Laravel backend serving a React + Vite + Tailwind CSS single-page app. AI-powered
construction management for homeowners, contractors, suppliers, and workers. Also
serves as the JSON API for the standalone `frontend/` Expo app (sibling project, see
its own `AGENTS.md`).

## Running the app

Two processes run side by side in development, both from this `backend/` directory:

```bash
php artisan serve   # Laravel backend, http://localhost:8000
npm run dev          # Vite dev server for React/HMR, http://localhost:5173
```

Visit `http://localhost:8000` — the Blade view pulls in the Vite dev server's
assets automatically via `@vite(...)` while `npm run dev` is running. For a
production-style build (no HMR, single server), run `npm run build` then only
`php artisan serve`; Laravel will serve the compiled assets from `public/build`.

To let a phone (the `frontend/` app) reach this server, bind it to all interfaces
instead: `php artisan serve --host=0.0.0.0 --port=8000`.

## Project Structure

- `routes/web.php` - Single catch-all route rendering `resources/views/app.blade.php` for every non-API path; React handles navigation client-side by role/section
- `routes/api.php` - Backend API routes: `/api/auth/*` (register/login/logout/me) and `/api/ai/plan` (auth-protected)
- `resources/views/app.blade.php` - Blade shell with the `#root` mount element and `@vite(...)` tags
- `resources/js/main.tsx` - React entrypoint; mounts `resources/js/App.tsx` into `#root`
- `resources/js/App.tsx` - Primary application component; role/section switch and navigation
- `resources/js/components/` - UI screens, grouped by role (`homeowner/`, `contractor/`, `supplier/`, `worker/`)
- `resources/js/lib/ai/` - Frontend AI plan client + shared `PlanContext` (React context) used by the homeowner AI screens
- `resources/css/app.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `app/Http/Controllers/Api/*` - Thin controllers only: validate via a Form Request, delegate to a service, shape the response. No business logic lives here.
- `app/Http/Requests/*` - Form Request classes hold all validation rules (`RegisterRequest`, `LoginRequest`, `GeneratePlanRequest`)
- `app/Services/AuthService.php` - User registration/credential-check logic, used by `AuthController`
- `app/Services/ConstructionPlanService.php` - The Anthropic API call + tool schema, used by `ConstructionPlanController`; throws `App\Exceptions\ConstructionPlanGenerationException` (carries the HTTP status to return) on failure
- `app/Console/Commands/MakeSuperAdmin.php` - `php artisan make:superadmin` — the only way to create/promote a superadmin; `admin`/`superadmin` are deliberately excluded from public self-registration (`User::SELF_REGISTERABLE_ROLES`)
- `app/Http/Middleware/EnsureUserHasRole.php` - reusable `role:admin,superadmin`-style route middleware, aliased as `role` in `bootstrap/app.php`
- `config/services.php` - `services.anthropic.key` / `services.anthropic.model`, read from `.env` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)
- `vite.config.ts` - Vite configuration with `laravel-vite-plugin`, React, Tailwind CSS v4, and the `@` alias for `resources/js`
- `tsconfig.json` - `@/*` maps to `resources/js/*`

## Dependencies

- Backend: Laravel (PHP 8.3+), MySQL (`DB_CONNECTION` in `.env`; SQLite also supported)
- Auth: Laravel Sanctum (bearer token auth — no CORS/stateful-domain config needed, this isn't cookie-based SPA auth)
- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, `@vitejs/plugin-react`, `laravel-vite-plugin`
- Formatting: oxfmt (JS/TS), Laravel Pint (PHP, `vendor/bin/pint`)

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `resources/css/app.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `resources/css/app.css`. This project does not need a Tailwind config file or PostCSS config.

## AI feature

The homeowner "AI Construction Planner" chat and the Budget/Material/Equipment/Design
estimator pages share one generated plan via `resources/js/lib/ai/PlanContext.tsx`.
Generating a plan calls `POST /api/ai/plan` (`ConstructionPlanController`), which asks
Claude (via a forced tool call, so the response is always valid JSON matching
`resources/js/lib/ai/types.ts`'s `ConstructionPlan` shape) and returns it directly.
Requires `ANTHROPIC_API_KEY` in `.env`. This endpoint requires an authenticated request
(Sanctum bearer token) and is rate-limited per user.

## Auth & roles

- Roles: `homeowner`, `contractor`, `supplier`, `worker` (self-registerable via
  `POST /api/auth/register`), plus `admin`/`superadmin` (not self-registerable — see
  `User::SELF_REGISTERABLE_ROLES` vs `User::ROLES`).
- Create the first superadmin with `php artisan make:superadmin {name} {email} {password}`
  (prompts for any omitted argument). Running it again with an existing email promotes
  that user to superadmin instead of creating a duplicate.
- Protect a future admin-only route with `->middleware('role:admin,superadmin')`.

## Architecture convention

Keep controllers thin: validation goes in a Form Request (`app/Http/Requests/`),
business logic goes in a service (`app/Services/`). A controller method should just be
"validate via type-hint → call a service → shape the response."

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export React components as default exports.
