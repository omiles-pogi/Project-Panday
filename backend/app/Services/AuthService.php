<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    /**
     * @param  array{name: string, email: string, password: string, role: string, business_name?: ?string, license_number?: ?string}  $data
     */
    public function register(array $data): User
    {
        return User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'approval_status' => 'pending',
            // Only the roles that need verifying keep these; homeowners never store them.
            'business_name' => in_array($data['role'], ['contractor', 'supplier'], true) ? ($data['business_name'] ?? null) : null,
            'license_number' => in_array($data['role'], User::VERIFIED_ROLES, true) ? ($data['license_number'] ?? null) : null,
        ]);
    }

    public function attempt(string $email, string $password): ?User
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        return $user;
    }
}
