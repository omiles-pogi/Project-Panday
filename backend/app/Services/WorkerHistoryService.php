<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;

class WorkerHistoryService
{
    /** The assignment pivot is authoritative; an application (even approved) is not an assignment. */
    private function completed(User $worker): BelongsToMany
    {
        return $worker->workerAssignments()->where('projects.status', 'completed')
            ->whereHas('user', fn ($query) => $query->where('role', 'homeowner'));
    }

    public function listFor(User $worker): Collection
    {
        return $this->completed($worker)->with('user:id,name')
            ->orderByDesc('completion_confirmed_at')->orderByDesc('projects.id')->get()
            ->map(fn (Project $project) => $this->summary($project, $worker));
    }

    public function detailsFor(User $worker, int $projectId): array
    {
        // Scope before loading any plan: changing a URL must not expose another worker's work.
        $project = $this->completed($worker)->with('user:id,name')->findOrFail($projectId);
        $plan = is_array($project->approved_plan) ? $project->approved_plan : [];

        return $this->summary($project, $worker) + [
            'location' => $project->location,
            'projectType' => $this->projectType($plan),
            'description' => $this->description($plan),
        ];
    }

    private function summary(Project $project, User $worker): array
    {
        return [
            'id' => $project->id,
            'title' => trim($project->title ?? '') ?: "Project #{$project->id}",
            'homeownerName' => $project->user->name,
            // The schema has no per-project historical trade snapshot; use the worker's recorded profile trade.
            'workerRole' => $worker->workerProfile?->trade,
            'status' => 'completed',
            'startedAt' => $project->started_at?->toDateString(),
            // Missing legacy confirmation dates remain unknown, never substituted with estimates.
            'completedAt' => $project->completion_confirmed_at?->toIso8601String(),
        ];
    }

    private function projectType(array $plan): ?string
    {
        // There is no separate project-type column. Only report recorded floor/style information.
        $parts = [];
        if (is_numeric($plan['floors'] ?? null) && $plan['floors'] > 0) {
            $parts[] = $plan['floors'].'-storey project';
        }
        if (is_string($plan['designStyle'] ?? null) && trim($plan['designStyle']) !== '') {
            $parts[] = trim($plan['designStyle']);
        }

        return $parts ? implode(' · ', $parts) : null;
    }

    private function description(array $plan): ?string
    {
        // Present only saved approved fields. Never read an initial prompt or call the AI here.
        if (is_string($plan['description'] ?? null) && trim($plan['description']) !== '') {
            return trim($plan['description']);
        }
        $parts = [];
        foreach (['exteriorConcept' => 'Exterior', 'interiorConcept' => 'Interior'] as $key => $label) {
            if (is_string($plan[$key] ?? null) && trim($plan[$key]) !== '') {
                $parts[] = $label.': '.trim($plan[$key]);
            }
        }
        $specifications = [];
        foreach (['areaSqm' => 'Floor area (sqm)', 'floors' => 'Storeys', 'bedrooms' => 'Bedrooms', 'bathrooms' => 'Bathrooms', 'garageCars' => 'Garage spaces'] as $key => $label) {
            if (isset($plan[$key]) && is_numeric($plan[$key]) && $plan[$key] >= 0) {
                $specifications[] = $label.': '.$plan[$key];
            }
        }
        if ($specifications) {
            $parts[] = implode(' · ', $specifications);
        }

        return $parts ? implode("\n\n", $parts) : null;
    }
}
