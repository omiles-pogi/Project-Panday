<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Collection;

class ProjectHistoryService
{
    public function __construct(private readonly ProjectService $projects) {}

    /** Official status is the only admission rule; missing legacy dates sort after recorded dates. */
    public function listFor(User $owner): Collection
    {
        return $owner->projects()->where('status', 'completed')
            ->orderByDesc('completion_confirmed_at')->orderByDesc('id')
            ->get(['id', 'title', 'status', 'started_at', 'completion_confirmed_at', 'approved_plan'])
            ->map(fn (Project $project) => $this->summary($project));
    }

    public function detailsFor(User $owner, int $projectId): array
    {
        // Scope ownership AND status before loading any plan, team, or financial records.
        $project = $owner->projects()->where('status', 'completed')->findOrFail($projectId);
        $hasTimeline = $project->started_at && $project->timeline_value > 0
            && in_array($project->timeline_unit, Project::TIMELINE_UNITS, true);

        return $this->summary($project) + [
            'plannedEndAt' => $hasTimeline ? $project->timelineEndDate($project->started_at)->toDateString() : null,
            // Reuse the existing owner-only, read-only presentation of the persisted project.
            'project' => $this->projects->planningContextFor($owner, $project->id),
        ];
    }

    private function summary(Project $project): array
    {
        $plan = $project->approved_plan ?? [];

        return [
            'id' => $project->id,
            'title' => trim($project->title ?? '') ?: "Project #{$project->id}",
            'status' => $project->status,
            'floors' => isset($plan['floors']) && is_numeric($plan['floors']) && $plan['floors'] > 0 ? (int) $plan['floors'] : null,
            'areaSqm' => isset($plan['areaSqm']) && is_numeric($plan['areaSqm']) && $plan['areaSqm'] > 0 ? (float) $plan['areaSqm'] : null,
            'designStyle' => $plan['designStyle'] ?? null,
            'startedAt' => $project->started_at?->toDateString(),
            // Never substitute a scheduled date, updated_at, or submission for confirmation.
            'completedAt' => $project->completion_confirmed_at?->toIso8601String(),
        ];
    }
}
