<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = $this->authService->register($request->validated());

        // New accounts must be approved by the admin before they can sign in, so no token yet.
        return response()->json([
            'user' => $user,
            'message' => 'Account created. You can sign in once an admin approves it.',
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = $this->authService->attempt($request->validated('email'), $request->validated('password'));

        if (! $user) {
            return response()->json([
                'error' => 'These credentials do not match our records.',
            ], 401);
        }

        if ($user->approval_status !== 'approved') {
            return response()->json([
                'error' => $user->approval_status === 'rejected'
                    ? 'Your account was not approved.'
                    : 'Your account is awaiting admin approval.',
                'approval_status' => $user->approval_status,
            ], 403);
        }

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('mobile')->plainTextToken,
        ]);
    }

    /**
     * Lets a freshly registered user's "waiting for approval" screen poll for the admin's
     * decision. Same credential check as login, but never issues a token.
     */
    public function approvalStatus(LoginRequest $request): JsonResponse
    {
        $user = $this->authService->attempt($request->validated('email'), $request->validated('password'));

        if (! $user) {
            return response()->json(['error' => 'These credentials do not match our records.'], 401);
        }

        return response()->json(['approval_status' => $user->approval_status]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }
}
