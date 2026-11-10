<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Http\Requests\UpdateAccountRequest;
use App\Http\Requests\VerifyPasswordResetCodeRequest;
use App\Services\AuthService;
use App\Services\PasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly PasswordResetService $passwordResets,
    ) {}

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

    /** Emails a 6-digit code if the address is registered. Same response either way, so this can't probe which emails have accounts. */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->passwordResets->requestCode($request->validated('email'));

        return response()->json(['message' => 'If that email is registered, a reset code is on its way.']);
    }

    /** Consume the OTP and return a short-lived reset grant, never the code itself. */
    public function verifyPasswordResetCode(VerifyPasswordResetCodeRequest $request): JsonResponse
    {
        return response()->json($this->passwordResets->verify(
            $request->validated('email'), $request->validated('code')
        ))->header('Cache-Control', 'no-store');
    }

    /** Requires a verified grant; an OTP alone cannot change a password. */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        try {
            $this->passwordResets->reset($request->validated('email'), $request->validated('reset_token'), $request->validated('password'));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        return response()->json(['message' => 'Password updated. You can sign in now.']);
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

    /** Any signed-in user can change their own name from their profile. */
    public function updateMe(UpdateAccountRequest $request): JsonResponse
    {
        return response()->json($this->authService->updateName($request->user(), $request->validated()['name']));
    }
}
