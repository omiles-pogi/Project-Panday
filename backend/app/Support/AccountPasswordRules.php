<?php

namespace App\Support;

use App\Models\User;
use Closure;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;

/** Shared registration/reset policy. Existing passwords can still be used to sign in. */
final class AccountPasswordRules
{
    public const UPDATE_ABILITY = 'password:update-required';

    /** Unicode White_Space, BOM and invisible separators; keep in sync with validators/auth.ts. */
    public static function hasWhitespace(string $password): bool
    {
        return preg_match('/[\x{0009}-\x{000D}\x{0020}\x{0085}\x{00A0}\x{1680}\x{2000}-\x{200B}\x{2028}\x{2029}\x{202F}\x{205F}\x{2060}\x{3000}\x{FEFF}]/u', $password) === 1;
    }

    public static function requiresUpdate(User $user): bool
    {
        $token = $user->currentAccessToken();

        return $token instanceof PersonalAccessToken && $token->can(self::UPDATE_ABILITY) && ! $token->can('*');
    }

    public static function rules(): array
    {
        return ['bail', 'required', 'string', function (string $attribute, mixed $value, Closure $fail): void {
            if (self::hasWhitespace($value)) {
                $fail('Passwords cannot contain spaces or whitespace characters.');
            }
        }, Password::min(8), function (string $attribute, mixed $value, Closure $fail): void {
            // Match the interface's explicit A-Z/a-z and 0-9 requirements, including Unicode input.
            if (! preg_match('/[A-Za-z]/', $value)) {
                $fail('Password must contain at least one letter (A-Z or a-z).');
            }
            if (! preg_match('/[0-9]/', $value)) {
                $fail('Password must contain at least one number (0-9).');
            }
        }, 'confirmed'];
    }

    public static function messages(): array
    {
        return [
            'password.required' => 'Please enter a password.',
            'password.string' => 'Please enter a valid password.',
            'password.min' => 'Password must be at least 8 characters.',
            'password.confirmed' => 'Passwords do not match.',
        ];
    }
}
