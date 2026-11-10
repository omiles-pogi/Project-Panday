<?php

namespace App\Services;

use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/** Reuse the existing reset row for an OTP, then a single-use grant. No schema change. */
class PasswordResetService
{
    private const CODE_TTL_MINUTES = 15;

    private const RESET_TTL_SECONDS = 300;

    private const VERIFIED_PREFIX = 'verified:';

    /** Same outcome for unknown emails; preserve delivery and supersede old credentials. */
    public function requestCode(string $email): void
    {
        $email = mb_strtolower(trim($email));
        $delivery = DB::transaction(function () use ($email) {
            // Lock the account first in every action to serialize resend/verify/reset.
            $user = User::where('email', $email)->lockForUpdate()->first();
            if (! $user) {
                return null;
            }
            $code = (string) random_int(100000, 999999);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($code), 'created_at' => now()]
            );
            RateLimiter::clear($this->attemptKey($email));

            return [$user, $code];
        });
        if (! $delivery) {
            return;
        }
        // Send outside the transaction; never return or log the OTP.
        [$user, $code] = $delivery;
        Mail::to($user->email)->send(new PasswordResetCodeMail($user, $code));
    }

    /** @return array{reset_token: string, expires_in: int} */
    public function verify(string $email, string $code): array
    {
        $email = mb_strtolower(trim($email));
        $grant = DB::transaction(function () use ($email, $code) {
            $user = User::where('email', $email)->lockForUpdate()->first();
            $record = DB::table('password_reset_tokens')->where('email', $email)->lockForUpdate()->first();
            $key = $this->attemptKey($email);
            $valid = ! RateLimiter::tooManyAttempts($key, 5)
                && $user && $record
                && ! str_starts_with($record->token, self::VERIFIED_PREFIX)
                && Carbon::parse($record->created_at)->addMinutes(self::CODE_TTL_MINUTES)->isFuture()
                && Hash::check($code, $record->token);
            if (! $valid) {
                RateLimiter::hit($key, self::CODE_TTL_MINUTES * 60);

                // Commit the failed-attempt count even with a database-backed cache.
                return null;
            }
            // Replace the OTP immediately, consuming it. Store only the SHA-256 digest
            // of a random 256-bit grant, returned to this caller once and valid for 5 minutes.
            $token = bin2hex(random_bytes(32));
            DB::table('password_reset_tokens')->where('email', $email)->update([
                'token' => self::VERIFIED_PREFIX.hash('sha256', $token),
                'created_at' => now(),
            ]);
            RateLimiter::clear($key);

            return ['reset_token' => $token, 'expires_in' => self::RESET_TTL_SECONDS];
        });
        if (! $grant) {
            throw ValidationException::withMessages(['code' => 'That code is invalid or has expired. Request a new one.']);
        }

        return $grant;
    }

    /** Consume the grant atomically with the password change and session revocation. */
    public function reset(string $email, string $token, string $password): void
    {
        $email = mb_strtolower(trim($email));
        DB::transaction(function () use ($email, $token, $password) {
            $user = User::where('email', $email)->lockForUpdate()->first();
            $record = DB::table('password_reset_tokens')->where('email', $email)->lockForUpdate()->first();
            $valid = $user && $record
                && Carbon::parse($record->created_at)->addSeconds(self::RESET_TTL_SECONDS)->isFuture()
                && hash_equals($record->token, self::VERIFIED_PREFIX.hash('sha256', $token));
            if (! $valid) {
                throw ValidationException::withMessages(['reset_token' => 'Reset authorization is invalid or has expired. Request a new code.']);
            }
            $user->update(['password' => Hash::make($password)]);
            $user->tokens()->delete();
            DB::table('password_reset_tokens')->where('email', $email)->delete();
        });
    }

    private function attemptKey(string $email): string
    {
        return 'password-reset-verification:'.hash('sha256', $email);
    }
}
