<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePortalAdmin
{
    /**
     * Only the one configured superadmin account (services.admin.email) may use the
     * admin portal API — holding the superadmin role alone is not enough.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user
            || $user->role !== 'superadmin'
            || strcasecmp($user->email, (string) config('services.admin.email')) !== 0) {
            return response()->json(['error' => 'This action is unauthorized.'], 403);
        }

        return $next($request);
    }
}
