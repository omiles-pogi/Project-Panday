<?php

namespace App\Models;

use App\Support\Wage;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'title', 'location', 'status', 'budget', 'total_estimate', 'timeline_months', 'started_at', 'ai_materials', 'approved_plan', 'materials_reviewed_at', 'materials_reviewed_by', 'auto_approve_materials', 'finished_at', 'finished_by', 'completion_confirmed_at', 'corrections_requested_at', 'corrections_note'])]
class Project extends Model
{
    /** active is "Ongoing"; pending_confirmation is a project the contractor has submitted as finished. */
    public const PENDING_CONFIRMATION = 'pending_confirmation';

    /** not_started: an empty placeholder awaiting its AI plan's approval. */
    public const STATUSES = ['not_started', 'active', self::PENDING_CONFIRMATION, 'completed'];

    protected function casts(): array
    {
        return [
            'started_at' => 'date',
            'ai_materials' => 'array',
            'approved_plan' => 'array',
            'materials_reviewed_at' => 'datetime',
            'auto_approve_materials' => 'boolean',
            'finished_at' => 'datetime',
            'completion_confirmed_at' => 'datetime',
            'corrections_requested_at' => 'datetime',
        ];
    }

    /** The contractor who submitted the project as finished. */
    public function finishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finished_by');
    }

    /**
     * How much of the checklist is done — completed tasks over all tasks, across every phase.
     * Nothing to do counts as 0%, never 100%, so an empty checklist can't be "finished".
     *
     * @return array{totalTasks: int, doneTasks: int, pct: int}
     */
    public function checklistSummary(): array
    {
        $this->loadMissing('phases.tasks');
        $tasks = $this->phases->flatMap(fn (ProjectPhase $phase) => $phase->tasks);
        $total = $tasks->count();
        $done = $tasks->where('is_done', true)->count();

        return ['totalTasks' => $total, 'doneTasks' => $done, 'pct' => $total > 0 ? (int) round($done / $total * 100) : 0];
    }

    /** Whether every task is checked off, and there is at least one. */
    public function checklistIsComplete(): bool
    {
        $summary = $this->checklistSummary();

        return $summary['totalTasks'] > 0 && $summary['doneTasks'] === $summary['totalTasks'];
    }

    /**
     * The finish-and-confirm trail, for the screens.
     *
     * @return array<string, mixed>
     */
    public function completionSummary(): array
    {
        return [
            'submittedAt' => $this->finished_at?->toIso8601String(),
            'submittedBy' => $this->finishedBy?->name,
            'confirmedAt' => $this->completion_confirmed_at?->toIso8601String(),
            'correctionsRequestedAt' => $this->corrections_requested_at?->toIso8601String(),
            'correctionsNote' => $this->corrections_note,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The contractor who reviewed the AI's material quantities, if anyone has. */
    public function materialsReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'materials_reviewed_by');
    }

    public function phases(): HasMany
    {
        return $this->hasMany(ProjectPhase::class)->orderBy('sort_order');
    }

    public function workers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_workers', 'project_id', 'worker_id')
            ->withPivot(Wage::PIVOT_COLUMNS)
            ->withTimestamps();
    }

    public function contractors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_contractors', 'project_id', 'contractor_id')
            ->withPivot(Wage::PIVOT_COLUMNS)
            ->withTimestamps();
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ProjectActivityLog::class)->orderBy('created_at');
    }

    public function workerRequests(): HasMany
    {
        return $this->hasMany(ProjectWorkerRequest::class);
    }

    public function contractorRequests(): HasMany
    {
        return $this->hasMany(ProjectContractorRequest::class);
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

    /** The calendar/timeline is for the homeowner and the contractors running the project — not workers. */
    public function canViewTimeline(User $user): bool
    {
        return ($user->role === 'homeowner' && $this->isOwnedBy($user))
            || ($user->role === 'contractor' && $this->hasAssignedContractor($user));
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

    /** Owner, or an assigned contractor acting on their behalf, can invite workers to the team. */
    public function canManageTeam(User $user): bool
    {
        return $this->isOwnedBy($user) || $this->hasAssignedContractor($user);
    }

    /** Weighted by each phase's share of total project effort/cost. */
    public function overallProgressPct(): int
    {
        $phases = $this->phases;
        $totalWeight = $phases->sum('weight_pct');
        if ($totalWeight <= 0) {
            // With no stated shares, count phases equally, as the calendar already does.
            return (int) round($phases->avg('progress_pct') ?? 0);
        }

        $weighted = $phases->sum(fn (ProjectPhase $phase) => $phase->weight_pct * $phase->progress_pct);

        return (int) round($weighted / $totalWeight);
    }
}
