<?php

namespace App\Services;

use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * A 6-digit code emailed to the account, good for 15 minutes, swapped for a new password. Reuses
 * Laravel's `password_reset_tokens` table (email as the primary key, so a fresh request replaces
 * any code already pending) but with a short numeric code instead of a long URL token — this app
 * has no web page for a reset link to land on, only the mobile app.
 */
class PasswordResetService
{
    private const CODE_TTL_MINUTES = 15;

    /** Always succeeds from the caller's point of view, even for an unknown email — never reveal which emails are registered. */
    public function requestCode(string $email): void
    {
        $user = User::where('email', $email)->first();
        if (! $user) {
            return;
        }

        $code = (string) random_int(100000, 999999);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            ['token' => Hash::make($code), 'created_at' => now()]
        );

        Mail::to($user->email)->send(new PasswordResetCodeMail($user, $code));
    }

    /** @throws ValidationException if the code is wrong, expired, or none was requested */
    public function reset(string $email, string $code, string $password): void
    {
        $record = DB::table('password_reset_tokens')->where('email', $email)->first();
        $valid = $record
            && ! Carbon::parse($record->created_at)->addMinutes(self::CODE_TTL_MINUTES)->isPast()
            && Hash::check($code, $record->token);

        if (! $valid) {
            throw ValidationException::withMessages(['code' => 'That code is invalid or has expired. Request a new one.']);
        }

        $user = User::where('email', $email)->firstOrFail();
        $user->update(['password' => Hash::make($password)]);
        // Resetting the password signs the account out everywhere else — the whole point if it
        // was forgotten because someone else had been using it.
        $user->tokens()->delete();

        DB::table('password_reset_tokens')->where('email', $email)->delete();
    }
}
