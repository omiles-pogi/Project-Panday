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
            'approval_status' => $data['role'] === 'homeowner' ? 'approved' : 'pending',
            // Only the roles that need verifying keep these; homeowners never store them.
            'business_name' => in_array($data['role'], ['contractor', 'supplier'], true) ? ($data['business_name'] ?? null) : null,
            'license_number' => in_array($data['role'], User::VERIFIED_ROLES, true) ? ($data['license_number'] ?? null) : null,
        ]);
    }

    /** Changes the name the user goes by; every screen reads it live from the user, so it shows everywhere at once. */
    public function updateName(User $user, string $name): User
    {
        $user->update(['name' => $name]);

        return $user;
    }

    public function attempt(string $email, string $password): ?User
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        // Upgrade legacy pending homeowners only after checking credentials. The conditional
        // write cannot undo an admin rejection/revocation made while this request was running.
        if ($user->role === 'homeowner' && $user->approval_status === 'pending') {
            User::whereKey($user->id)->where('role', 'homeowner')->where('approval_status', 'pending')
                ->update(['approval_status' => 'approved']);
            $user->refresh();
        }

        return $user;
    }
}
