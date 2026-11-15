<?php

namespace App\Http\Middleware;

use App\Support\AccountPasswordRules;
use Closure;
use Illuminate\Http\Request;

class EnsurePasswordUpdateCompleted
{
    public function handle(Request $request, Closure $next)
    {
        // A proven legacy password grants only a short-lived update session. Never block
        // identity checks, logout or the existing password-change endpoint needed to recover.
        if (AccountPasswordRules::requiresUpdate($request->user()) && ! (
            ($request->isMethod('GET') && $request->is('api/auth/me'))
            || ($request->isMethod('POST') && $request->is('api/auth/logout', 'api/account/password'))
        )) {
            return response()->json(['error' => 'Update your existing password to remove whitespace before continuing.', 'code' => 'password_update_required'], 403);
        }

        return $next($request);
    }
}
