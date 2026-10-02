<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Restrict a route to users whose `role` is in the given list, e.g.
     * `->middleware('role:admin,superadmin')`.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user() || ! in_array($request->user()->role, $roles, true)) {
            return response()->json(['error' => 'This action is unauthorized.'], 403);
        }

        return $next($request);
    }
}
