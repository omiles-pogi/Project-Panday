<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

abstract class Controller
{
    /**
     * Runs $action and returns its result as JSON, turning a ValidationException — how every
     * Service in this app reports an ordinary business-rule failure (a wrong role, an already-
     * resolved request, a rule the acting user broke), not just form validation — into the app's
     * standard 422 error shape instead of a 500.
     *
     * @param  Closure(): mixed  $action
     */
    protected function attempt(Closure $action, int $status = 200): JsonResponse
    {
        try {
            return response()->json($action(), $status);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
