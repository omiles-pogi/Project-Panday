<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'title', 'location', 'status', 'budget', 'total_estimate', 'timeline_months', 'started_at'])]
class Project extends Model
{
    public const STATUSES = ['active', 'completed'];

    protected function casts(): array
    {
        return [
            'started_at' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function phases(): HasMany
    {
        return $this->hasMany(ProjectPhase::class)->orderBy('sort_order');
    }

    public function workers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_workers', 'project_id', 'worker_id')
            ->withTimestamps();
    }

    public function contractors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_contractors', 'project_id', 'contractor_id')
            ->withTimestamps();
    }

    public function isOwnedBy(User $user): bool
    {
        return $this->user_id === $user->id;
    }

    public function hasAssignedContractor(User $user): bool
    {
        return $this->contractors->contains('id', $user->id);
    }

    public function hasAssignedWorker(User $user): bool
    {
        return $this->workers->contains('id', $user->id);
    }

    /** Owner, assigned contractors, and assigned workers can all view a project. */
    public function isVisibleTo(User $user): bool
    {
        return $this->isOwnedBy($user) || $this->hasAssignedContractor($user) || $this->hasAssignedWorker($user);
    }

    /** Only assigned contractors manage the phase checklist. */
    public function isManageableBy(User $user): bool
    {
        return $this->hasAssignedContractor($user);
    }

    /** Weighted by each phase's share of total project effort/cost. */
    public function overallProgressPct(): int
    {
        $phases = $this->phases;
        $totalWeight = $phases->sum('weight_pct');
        if ($totalWeight <= 0) {
            return 0;
        }

        $weighted = $phases->sum(fn (ProjectPhase $phase) => $phase->weight_pct * $phase->progress_pct);

        return (int) round($weighted / $totalWeight);
    }
}
