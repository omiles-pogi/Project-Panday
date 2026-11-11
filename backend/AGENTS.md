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
- `routes/api.php` - Backend API routes: `/api/auth/*` (register/login/logout/me, plus `PATCH /api/auth/me`, which lets any signed-in user change their own `name` — and only that: email, role and the verified business name / license are fixed at approval and never accepted) and `/api/ai/plan` (auth-protected)
- `resources/views/app.blade.php` - Blade shell with the `#root` mount element and `@vite(...)` tags
- `resources/js/main.tsx` - React entrypoint; mounts `resources/js/App.tsx` into `#root`
- `resources/js/App.tsx` - Primary application component; role/section switch and navigation
- `resources/js/components/` - UI screens, grouped by role (`homeowner/`, `contractor/`, `supplier/`, `worker/`)
- `resources/js/lib/ai/` - Frontend AI plan client + shared `PlanContext` (React context) used by the homeowner AI screens
- `resources/css/app.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `app/Http/Controllers/Api/*` - Thin controllers only: validate via a Form Request, delegate to a service, shape the response. No business logic lives here.
- `app/Http/Requests/*` - Form Request classes hold all validation rules (`RegisterRequest`, `LoginRequest`, `GeneratePlanRequest`)
- `app/Services/AuthService.php` - User registration/credential-check logic, used by `AuthController`
- `app/Services/ConstructionPlanService.php` - The Groq API call + tool schema, used by `ConstructionPlanController`; throws `App\Exceptions\ConstructionPlanGenerationException` (carries the HTTP status to return) on failure
- `app/Services/SupplierProductService.php` - Supplier inventory (`/api/supplier-products`, `role:supplier`, owner-only edits) and the read-only buyer catalog (`/api/materials`, `role:homeowner,contractor`). `stock_status` is always derived from `stock` (> 0 → `in_stock`), never stored; `is_active` only hides/shows a listing
- `app/Services/SupplierProfileService.php` - A supplier's own profile (`GET`/`PUT /api/supplier-profile`, `role:supplier`): the verified account details (business name and license stay on `users`, read-only here) plus the editable shop details in `supplier_profiles` (`location`, `contact_number`, `bio`), and how many listings are active / in stock. Buyers see `location` and `contact_number` on the catalog's `supplier.supplier_profile`; `bio` stays on the profile page
- `app/Services/HomeownerProfileService.php` - A homeowner's own profile (`GET`/`PUT /api/homeowner-profile`, `role:homeowner`): account details, project counts by status, and the editable `location` / `contact_number` in `homeowner_profiles`. Private — no other endpoint returns it (contractors and workers only get `ownerName`); share it deliberately, per project, if that is ever wanted. Name, email and role are not editable here
- `app/Services/ChatService.php` - Homeowner ↔ contractor project messaging (`/api/conversations/*`). One thread per project + pair (unique index); access requires the real `project_contractors` link to start/send, and participation to read. Delivery is client polling (`after_id`), not websockets; `client_key` makes sends idempotent
- `app/Services/MaterialRequestService.php` / `SupplierFulfillmentService.php` / `MaterialWorkflow.php` - Material workflow: contractor drafts a request (`/api/material-requests`) → homeowner approves/revises/rejects → approval splits items into one `SupplierFulfillment` per supplier (`/api/supplier-fulfillments`, supplier sees only their own) → supplier confirms (reserves stock) or reports insufficient/declines (request returns for revision) → changed prices need homeowner confirmation → confirmed → contractor confirms receipt (deducts stock) → request `completed`. There is no delivery-progress tracking in between — a supplier's only states after confirming are the result (received) or a cancellation. `material_requests.status` is approval only; fulfillment lives on `supplier_fulfillments.status`; every transition is logged in `material_request_status_logs`
- `app/Services/StockService.php` - The only code that moves `supplier_products.reserved`/`stock`, via single conditional UPDATEs (no double-promising, no negatives). Available-to-promise = `stock - reserved`, which `stock_status` is derived from
- `app/Services/ProjectCompletionService.php` - Finishing a project, a handshake with a status flow: `active` (shown as "Ongoing") → the assigned contractor submits it (`POST /api/projects/{project}/completion/submit`) → `pending_confirmation` → the project's homeowner confirms (`…/completion/confirm`, → `completed`, `completion_confirmed_at` recorded) or asks for corrections (`…/completion/request-corrections`, a note is required; → back to `active`, the note shown to the contractor until they resubmit). Nothing finishes by itself: 100% only makes "Mark Project as Finished" available. Submitting needs ≥1 task and every task done (`Project::checklistSummary()` — completed ÷ total tasks, 0% when there are none), re-checked under a row lock in a transaction, as is every transition; `finished_at`/`finished_by` record the submission (cleared if corrections are requested). `POST /api/projects/{project}/phases/{phase}/checklist/check-all|uncheck-all` (one phase at a time, the phase must belong to the project) run the existing `ProjectService::updatePhaseTask` per changed task inside one transaction, so completion times, phase progress and activity-log rows stay exactly as when ticked one by one. The checklist is only editable while `active` (`ProjectService::assertCanManageChecklist`, used by add/toggle/delete/check-all) — locked once submitted or completed. `my-projects` adds `checklistLocked` and `canSubmitCompletion`; every project adds `checklist`, `completion` and (owner) `canConfirmCompletion`. `pending_confirmation` still counts as active in the stats, and the team can be rated once the project is `completed`. Overall progress (`overallProgressPct`) is still phase-weighted; the completion rule uses the plain task count
- `app/Services/WorkerActivityService.php` - A worker's day on site: attendance (`POST /api/projects/{project}/attendance/check-in|check-out`, `GET /api/worker/attendance`), the daily work log (`PUT /api/projects/{project}/work-log`, one per project per day, writable for today and the past 7 days; `GET /api/worker/work-logs`) and earnings (`GET /api/worker/earnings`), all `role:worker` and only for a project the worker is on and that is `active`. The homeowner and assigned contractors see the team's version at `GET /api/projects/{project}/team-activity` (`role:homeowner,contractor`, owner or assigned contractor only). "Today" is the Philippine day (Asia/Manila), not the server's UTC one, so a 6 am check-in isn't filed under yesterday; `work_date`/`log_date` are deliberately plain `Y-m-d` strings, not date-cast. Earnings aren't stored: a `per_day` wage earns rate × days checked in; a `fixed` fee or no wage gives `earned: null` (the fee is agreed up front, so nothing is derived per day). Payment itself isn't tracked
- `app/Services/NotificationService.php` - The in-app notification feed (`/api/notifications`: list, unread count, mark read / read all, delete one). `DELETE /api/notifications` is "Clear all": it deletes the user's whole feed (not just the 50 the list returns) but keeps invite/application notifications whose request is still `pending` — that notification is the only place to accept or decline, so clearing it would strand the request — and answers `{cleared, kept}`
- `app/Services/PushService.php` - Push notifications through Expo's push service. `NotificationService::send()` records the in-app notification and then calls `PushService::notify()`, which posts it to every `device_tokens` row of the recipient (`POST|DELETE /api/device-tokens`, registered by the app after sign-in and removed on sign-out; a token belongs to one user, the last to register). It is only a nudge: no registered phone costs nothing, an unreachable Expo is logged and ignored, and a token Expo reports `DeviceNotRegistered` is deleted. `EXPO_PUSH_URL` / `EXPO_ACCESS_TOKEN` (only if the Expo project has enhanced security on) live in `config/services.php`. Delivery needs a real app build with an Expo project and Firebase credentials — not Expo Go
- `app/Services/ScheduleAlertService.php` - Delay alerts: tells the homeowner and the assigned contractors (never workers, who can't see the calendar) with a `schedule_delay` notification when a project becomes `slightly_behind` or `significantly_behind` — the calendar's own statuses, so an alert never disagrees with its screen. `projects.delay_alert_level` (0/1/2) remembers the worst level already announced, so a slip alerts once and again only if it worsens; recovering lowers it, which re-arms the alert; it moves with one conditional UPDATE so concurrent checks can't double-send. Only `active` projects are checked. It runs two ways: `php artisan projects:check-delays [--project=ID]`, scheduled daily 08:00 Asia/Manila in `routes/console.php` (needs `php artisan schedule:work` locally or a `schedule:run` cron in production — nothing else runs it), and on every calendar view (`ProjectTimelineController`), so alerts still go out where no scheduler runs
- `app/Services/TimelineService.php` - Calendar project monitoring (`GET /api/projects/{project}/timeline`, `role:homeowner,contractor`; the owner or an assigned contractor only — workers are excluded even when on the project). The AI plan's per-phase `durationWeeks` is laid out back-to-back across `started_at` + the project's timeline (`timeline_value`/`timeline_unit` — days, weeks or months; `Project::timelineEndDate()`) and stored as `project_phases.planned_start/planned_end` (phases with no duration — older plans, hand-added — are split by `weight_pct`; projects from before the feature are scheduled lazily on first view). Tasks aren't stored with dates: each phase's checklist is spread evenly across its window in id order, and a task is "due" on its planned end. Actual progress is replayed from `project_phase_tasks.completed_at` (set on check-off, cleared on un-check), compared with planned progress to give `ahead` / `on_track` / `slightly_behind` (−5 to −15 pts) / `significantly_behind` (< −15)
- `app/Console/Commands/MakeSuperAdmin.php` - `php artisan make:superadmin` — the only way to create/promote a superadmin; `admin`/`superadmin` are deliberately excluded from public self-registration (`User::SELF_REGISTERABLE_ROLES`)
- `app/Http/Middleware/EnsureUserHasRole.php` - reusable `role:admin,superadmin`-style route middleware, aliased as `role` in `bootstrap/app.php`
- `config/services.php` - `services.groq.key` / `services.groq.model`, read from `.env` (`GROQ_API_KEY`, `GROQ_MODEL`)
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
Groq (via a forced tool call, so the response is always valid JSON matching
`resources/js/lib/ai/types.ts`'s `ConstructionPlan` shape) and returns it directly.
Requires `GROQ_API_KEY` in `.env`. This endpoint requires an authenticated request
(Sanctum bearer token) and is rate-limited per user.

Groq's free tier caps an org at **8000 tokens/minute**, and each request reserves its prompt +
`max_completion_tokens` against that up front, so `ConstructionPlanService` keeps requests small and
survives the limit instead of surfacing it: it sends only the last 12 messages (the current plan
travels separately), sizes `max_completion_tokens` to what fits under `GROQ_TPM_LIMIT` (default 8000 —
raise it after upgrading), uses `GROQ_REASONING_EFFORT` (default `low`, gpt-oss models only; reasoning
tokens count too), and on a 429 sleeps out Groq's `Retry-After` (≤ 45s, once) before retrying — it's
rejected before streaming starts, so the homeowner just sees "thinking". Only if that fails does it
tell them how long to wait; raw Groq messages are never passed through. Keep the system prompt lean:
every token added to it is one less for the reply.

### Supplier-sourced pricing

The homeowner picks one supplier for each of `SupplierProduct::PLAN_CATEGORIES` — Construction
Materials, Electrical and Plumbing, Finishing Works (each covers fixed listing categories; together they
cover every `SupplierProduct::CATEGORIES` entry). `GET /api/ai/supplier-options` (`role:homeowner`) feeds
the picker; the choice travels as `supplier_selections` on `POST /api/ai/plan` and is echoed back on the
plan as `supplierSelections`. `SupplierProductService::pricingContextForPrompt($selections)` gives the AI
the *real* in-stock listings (id | name | unit | price) from approved suppliers — only the chosen
supplier's for a chosen category, else the cheapest per item with who sells it. The AI marks each material
with the listing id it used (`supplierProductId`, 0 = estimate), but the server never trusts that:
`ConstructionPlanService::applySupplierData` re-checks every id against the database (exists, active,
approved supplier, and the chosen supplier for its category) and overwrites the line's name, unit and
price from the listing, dropping the link otherwise. The link is saved in `projects.ai_materials`, so the
contractor's material request (`MaterialRequestService::aiSuggestions`) starts from the chosen listing.

The prompt only has room for a dozen or so rows per plan category (`CHOSEN_SUPPLIER_ROWS` / `AUTO_ROWS`;
the listings come out of the room left for the plan itself, see `replyTokenBudget`), so `spread()` takes
them round-robin across listing categories, oldest listing first — never "the N cheapest", which on a
~90-item catalog is all fasteners and no cement. Raise those caps only after checking the reply budget.

Demo catalog: `php artisan db:seed --class=SupplierSheetSeeder` loads the 91-material listing sheet
(foundation → finishes) as the supplier "Tripple R" and gives every other approved supplier the same list at
their own prices. Materials Tripple R left unpriced are added inactive at ₱0 (hidden from buyers until it
prices them); the other suppliers price those. Listings a supplier already has by name are never edited.

## Material planning

Materials are planned **by phase** and approved **by exception**. The AI plan gives each material the
`phase` it is first needed in (`ConstructionPlanService::normalizeMaterialPhases` holds it to a real phase
name, else `''`), stored in `projects.ai_materials`. `GET /api/projects/{id}/material-plan`
(`MaterialPlanService`) groups those lines per phase with a `neededBy` date = the phase's calendar start
minus `MATERIAL_LEAD_DAYS` (7), plus the budget room per category. `PUT .../material-plan/review`: the
contractor checks the AI's quantities **once** (quantity they need + 0–50% waste, stored as
`reviewedQty`/`contractorQty`/`wastePct` on the lines, `materials_reviewed_at/by` on the project) and the
homeowner is notified; `POST .../material-plan/phases/{phase}/request` then drafts that phase's request from
the reviewed plan (refused until reviewed; asking again resumes the draft). Items remember `ai_quantity` (the
AI's figure) and `plan_quantity` (what the reviewed plan allows), always worked out server-side by
`PlanMaterials::match` — never from the client.

**Importing the AI estimate** (`GET /api/projects/{id}/ai-materials`) gives each plan line a listing and a
`matchKind`: `plan` (the listing the plan was priced from), `exact` (same name), `similar` (closest wording), or
null. The AI rarely words a material like a listing, so `PlanMaterials::similarity` (also the last tier of
`match`, which is how a similar listing still counts as the plan's material) accepts a listing when every size
in the AI's name is in it (10mm ≠ 12mm), they share a real word, and ≥ half their words agree; ties go to the
same unit, the homeowner's chosen supplier, then stock and price. A line nothing resembles stays unmatched and
can't be submitted until a listing is picked — the app walks the contractor through those — and the catalog
search (`SupplierProductService::catalog`) matches words in any order, falling back to the listings with the
most of the words when none has them all.

`MaterialApprovalPolicy` decides, on submit, whether a request approves itself: every item is in the plan, the
totals per plan material (this request + earlier approved ones) stay within `plan_quantity`, each category
stays within the approved plan's `budgetBreakdown` (counting what earlier requests already committed), items
come from the supplier the homeowner chose for that category, and stock covers them. If so it is approved with
no approver (history shows the system and why; `auto_approved`) and everyone is notified; otherwise the plain
reasons are saved in `approval_flags` and shown to the homeowner as the only things to decide. Never applies
when the plan has no budget to check, or when the homeowner switches it off
(`PATCH /api/projects/{id}/material-settings`, `projects.auto_approve_materials`, default on). The AI prompt
has almost no token headroom (`PlannerAppDataTest` guards it), so keep additions there tiny.

## Team wages

What a worker or contractor is paid lives on their link to the project (`project_workers` /
`project_contractors`: `wage_amount`, `wage_unit` `per_day`|`fixed`, `wage_days`), not their profile — the
same person can be paid differently per job. `App\Support\Wage` does the math (day rate × days, or the
fixed fee). `PATCH /api/projects/{project}/workers/{worker}/wage` and `.../contractors/{contractor}/wage`
(null amount clears it): the homeowner sets anyone's; a contractor on the project sets their *workers'*
only, never a contractor's (including their own). `ProjectService::visibleWage` decides who sees what —
the homeowner sees every wage and `teamWageTotal`, a contractor sees the workers' and their own fee (not
another contractor's), a worker sees only their own (`myWage` on `/api/my-projects`). A contractor who
applied with a `quote_amount` starts at that as a fixed fee once approved. Setting a wage notifies the
member (`wage_set`).

**Automatic wages** (`WageService`, flagged `wage_auto`): nobody has to type wages in. When a worker or
contractor joins a project they get one — a worker's is their own minimum daily wage (else
`WAGE_DEFAULT_DAILY_RATE`, ₱850) × the project's working days (`Project::timelineDays()` scaled by
`WAGE_WORKING_DAYS_PER_MONTH`/26, six-day weeks — a project timed in days/weeks/months all convert the same way); a contractor's is their quote if they applied with one, else the approved plan's "Contractor and Project
Management Fee" line, else `WAGE_CONTRACTOR_FEE_PCT` (10%) of the estimate, split between the project's
contractors. Joining fills only the newcomer. Automatic wages stay current — a worker changing their minimum
re-works theirs, a new contractor re-splits the fee — but setting a wage by hand clears `wage_auto`, after which
the app never touches it, and a wage someone cleared on purpose is not brought back. `php artisan wages:fill
[--project=ID]` backfills everyone already on a project (safe to repeat); see `config/wages.php`.

A worker can also state the lowest day rate they'll take (`worker_profiles.min_daily_wage`, set through
`PUT /api/worker-profile`, optional — omitting it leaves it alone, null clears it). It's returned as
`minDailyWage` in the team search, a worker's profile and a project's worker list, but only to homeowners and
contractors (`WorkerService::canSeeMinWage`) and the worker themself — other workers never see it. It is a guide,
not a rule: the wage sheet shows it and warns below it, but doesn't block a lower wage.

## Estimate adjustments

`projects.total_estimate` is the AI's estimate **at the start** and is never rewritten. When the work outgrows
the plan, `EstimateAdjustmentService::forProject` works out what to add on top, and `ProjectService::present`
returns `totalEstimate` = plan + additions (the plan's own figure stays in `planEstimate`, the breakdown in
`estimateAdjustment`) — so AI Estimate goes up and Left Over (budget − estimate) goes down on their own. Only
commitments **beyond the plan** count: items on approved/completed requests that have a live supplier order and
are not in the plan's material list, or exceed that material's planned quantity (the excess at the confirmed
price, else the estimated one); and team wages (agreed + automatic) above the plan's "Labor Costs" line, or a
contractor's above "Contractor and Project Management Fee". Hiring or ordering *within* the plan changes
nothing, a plan with no material list or no such budget line is skipped rather than guessed at, and price
differences on in-plan materials aren't counted. Pending requests are only a heads-up (`pendingMaterialsTotal`);
they join on approval and drop out if cancelled. Only the **homeowner** gets the adjusted figures —
contractors and workers see `planEstimate` as `totalEstimate` and a null `estimateAdjustment`. A pending request
carries `estimateImpact` (what approving would do to the estimate and left over) for the homeowner's decision.

When the estimate ends up past the homeowner's budget they can raise it: `POST /api/projects/{project}/budget`
(`{amount}`, homeowner only, `ProjectService::addBudget`) **adds** `amount` pesos rather than setting a total, so
two stale screens can't undo each other. It moves `projects.budget` and the copy in `approved_plan.budget`
together and returns the project as the dashboard shows it. The estimate itself is never editable — more budget
is the only way to close a shortfall. A "not started yet" project has no budget to add to.

## New projects

"New Project" in the mobile app calls `POST /api/projects/draft`, which adds an empty
`status = 'not_started'` placeholder to the homeowner's projects straight away (and returns the
existing one if they already have one — never more than one blank). The AI chat is keyed to that
project's id; approving the plan calls `POST /api/projects/{id}/plan`, which fills the placeholder in
and flips it to `active` (a non-placeholder gets a 422). Placeholders are excluded from every
`status = 'active'` listing (browse/apply, stats), can't have a team invited, and have no schedule;
`POST /api/projects` still creates an already-active project for chats with no placeholder.

## Auth & roles

- Roles: `homeowner`, `contractor`, `supplier`, `worker` (self-registerable via
  `POST /api/auth/register`), plus `admin`/`superadmin` (not self-registerable — see
  `User::SELF_REGISTERABLE_ROLES` vs `User::ROLES`).
- Create the first superadmin with `php artisan make:superadmin {name} {email} {password}`
  (prompts for any omitted argument). Running it again with an existing email promotes
  that user to superadmin instead of creating a duplicate.
- Protect a future admin-only route with `->middleware('role:admin,superadmin')`.
- Registration email must be real and deliverable: `RegisterRequest` validates with
  `bail`, `email:rfc,dns` (rejects malformed/non-existent domains), and
  `indisposable:mx` (rejects known disposable/throwaway providers via
  `propaganistas/laravel-disposable-email`). `bail` is required — without it, the
  disposable-email check's own DNS lookup can throw on a domain that `email:rfc,dns`
  already rejected as non-existent.

## Architecture convention

- `SupplierHistoryService` / `GET /api/supplier-history[/{projectId}]` provide supplier-only, read-only history from the authenticated supplier's `received` fulfillments and their own confirmed, positive-quantity material lines. Parent requests must be approved/completed or legitimately returned for revision; cancelled/rejected/draft/pending requests do not qualify. Projects must belong to homeowners; dashboard visibility and project completion status do not restrict supply history. Final `confirmed_unit_price` snapshots determine totals, never live inventory or estimate prices. Missing final prices make the total unknown with an explicit known subtotal, and missing receipt dates remain null. Repeated lines remain separate; the list groups once per project and orders by latest receipt. Details expose only project type/location, homeowner name, receipt metadata, and the supplier's supplied lines, never project descriptions or another supplier's amounts. No migration is needed.
- `ProjectHistoryService` and `ProjectHistoryController` expose read-only `GET /api/project-history` and `GET /api/project-history/{projectId}` to homeowners. Both queries require ownership and official `completed` status; ordering uses `completion_confirmed_at` (unknown legacy dates last). Details reuse `ProjectService::planningContextFor` for the saved plan, team, phases, and existing budget/fulfillment records. History does not transition status, record payments, or need a schema change.
- `ProjectNamingService` / `PATCH /api/projects/{project}/name` let the owning homeowner finish a pending post-finalization naming step. The existing `title` and `approved_plan.projectTitle` update together; server-owned `_projectNamePending` / `_finalizationKey` metadata in the existing JSON restores the step and makes keyed finalization retries idempotent. Naming never advances project status. Legacy plans with no naming marker retain their titles and are not prompted again.
- `ProjectDashboardService` / `PATCH /api/projects/{project}/hide-from-dashboard` set `is_hidden_from_dashboard` only for a completed project owned by the homeowner. `/api/projects?dashboard_only=1`, `/api/dashboard?dashboard_only=1`, and the Home landing feed respect that preference; History, the planner, team assignments, and supplier access stay unfiltered. The additive `2026_11_11_110000` migration defaults the flag to false. Before that migration is deployed, Home reads remain available and the write refuses with 503. Permanent deletion is a separate existing endpoint and is not used by Project Overview's completed-project X.
- `GET /api/home-dashboard` is the read-only homeowner landing feed, also respecting dashboard visibility. It returns visible project summaries for existing draft resumption, `active` projects only for ongoing cards, and the newest eight recorded project creation/completion/submission, membership-pivot, and checklist-log events. Missing event times are omitted; there is no fabricated AI-generation event. The feed does not change project selection, status, or stored records. Explicit Project Overview links keep using the existing authorized project dashboard API.

Keep controllers thin: validation goes in a Form Request (`app/Http/Requests/`),
business logic goes in a service (`app/Services/`). A controller method should just be
"validate via type-hint → call a service → shape the response."

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export React components as default exports.
