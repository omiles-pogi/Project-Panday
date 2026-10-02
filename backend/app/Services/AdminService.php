<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdminService
{
    /** Roles managed through approval (admin accounts are never listed or modified here). */
    private const MANAGED_ROLES = User::SELF_REGISTERABLE_ROLES;

    /**
     * @return array<string, mixed>
     */
    public function stats(): array
    {
        $managed = fn () => User::whereIn('role', self::MANAGED_ROLES);

        $byStatus = $managed()->select('approval_status', DB::raw('count(*) as total'))
            ->groupBy('approval_status')->pluck('total', 'approval_status');
        $byRole = $managed()->select('role', DB::raw('count(*) as total'))
            ->groupBy('role')->pluck('total', 'role');

        $days = collect(range(13, 0))->map(fn (int $ago) => Carbon::today()->subDays($ago));
        $signupCounts = $managed()
            ->where('created_at', '>=', $days->first())
            ->get(['created_at'])
            ->groupBy(fn (User $u) => $u->created_at->toDateString())
            ->map->count();

        $activeUsers = DB::table('personal_access_tokens')
            ->whereIn('tokenable_id', $managed()->select('id'))
            ->where('last_used_at', '>=', now()->subDays(7))
            ->distinct()->count('tokenable_id');

        return [
            'totals' => [
                'users' => $managed()->count(),
                'pending' => (int) ($byStatus['pending'] ?? 0),
                'approved' => (int) ($byStatus['approved'] ?? 0),
                'rejected' => (int) ($byStatus['rejected'] ?? 0),
                'active_7d' => $activeUsers,
                'new_7d' => $managed()->where('created_at', '>=', now()->subDays(7))->count(),
            ],
            'by_role' => collect(self::MANAGED_ROLES)
                ->map(fn (string $role) => ['role' => $role, 'total' => (int) ($byRole[$role] ?? 0)])
                ->values(),
            'signups' => $days->map(fn (Carbon $day) => [
                'date' => $day->toDateString(),
                'total' => (int) ($signupCounts[$day->toDateString()] ?? 0),
            ])->values(),
        ];
    }

    /**
     * @return Collection<int, User>
     */
    public function users(?string $status, ?string $role, ?string $search): Collection
    {
        return User::query()
            ->whereIn('role', self::MANAGED_ROLES)
            ->when($status, fn ($q) => $q->where('approval_status', $status))
            ->when($role, fn ($q) => $q->where('role', $role))
            ->when($search, fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->latest()
            ->limit(200)
            ->get(['id', 'name', 'email', 'role', 'approval_status', 'created_at']);
    }

    public function setApproval(User $user, string $status): User
    {
        $user->update(['approval_status' => $status]);

        // A user who is no longer approved must be signed out of every device.
        if ($status !== 'approved') {
            $user->tokens()->delete();
        }

        return $user;
    }

    public function isManaged(User $user): bool
    {
        return in_array($user->role, self::MANAGED_ROLES, true);
    }
}
