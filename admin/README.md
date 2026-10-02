# Project-Panday Admin (reserved)

This folder is reserved for a future admin dashboard — not built yet.

The backend already has the access-control foundation ready for it:
- `admin`/`superadmin` roles exist on the `User` model but are excluded from public
  self-registration (`backend/app/Models/User.php`'s `SELF_REGISTERABLE_ROLES`).
- The first superadmin is created via `php artisan make:superadmin {name} {email}
  {password}` (from `backend/`) — never through the API.
- `backend/app/Http/Middleware/EnsureUserHasRole.php` is ready to protect future
  admin-only routes: `->middleware('role:admin,superadmin')`.

When it's time to build this, it will likely follow the same pattern as `frontend/`
(or `backend/resources/js`): a standalone client calling the backend's JSON API.
