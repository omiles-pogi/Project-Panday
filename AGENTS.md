# BuildAI

Laravel backend serving a React + Vite + Tailwind CSS single-page app. AI-powered
construction management for homeowners, contractors, suppliers, and workers.

## Running the app

Two processes run side by side in development:

```bash
php artisan serve   # Laravel backend, http://localhost:8000
npm run dev          # Vite dev server for React/HMR, http://localhost:5173
```

Visit `http://localhost:8000` — the Blade view pulls in the Vite dev server's
assets automatically via `@vite(...)` while `npm run dev` is running. For a
production-style build (no HMR, single server), run `npm run build` then only
`php artisan serve`; Laravel will serve the compiled assets from `public/build`.

## Project Structure

- `routes/web.php` - Single catch-all route rendering `resources/views/app.blade.php` for every non-API path; React handles navigation client-side by role/section
- `routes/api.php` - Backend API routes (currently: `POST /api/ai/plan`)
- `resources/views/app.blade.php` - Blade shell with the `#root` mount element and `@vite(...)` tags
- `resources/js/main.tsx` - React entrypoint; mounts `resources/js/App.tsx` into `#root`
- `resources/js/App.tsx` - Primary application component; role/section switch and navigation
- `resources/js/components/` - UI screens, grouped by role (`homeowner/`, `contractor/`, `supplier/`, `worker/`)
- `resources/js/lib/ai/` - Frontend AI plan client + shared `PlanContext` (React context) used by the homeowner AI screens
- `resources/css/app.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `app/Http/Controllers/Api/ConstructionPlanController.php` - Calls the Anthropic API server-side (key stays out of the browser bundle) and returns a structured construction plan
- `config/services.php` - `services.anthropic.key` / `services.anthropic.model`, read from `.env` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)
- `vite.config.ts` - Vite configuration with `laravel-vite-plugin`, React, Tailwind CSS v4, and the `@` alias for `resources/js`
- `tsconfig.json` - `@/*` maps to `resources/js/*`

## Dependencies

- Backend: Laravel (PHP 8.3+), SQLite by default (`DB_CONNECTION` in `.env`)
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
Requires `ANTHROPIC_API_KEY` in `.env`.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export React components as default exports.
