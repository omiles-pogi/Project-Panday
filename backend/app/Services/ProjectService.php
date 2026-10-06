<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ProjectService
{
    /**
     * @param  array<string, mixed>  $plan  A validated construction plan payload (see StoreProjectRequest).
     */
    public function createFromPlan(User $user, array $plan): Project
    {
        $project = $user->projects()->create([
            'title' => $plan['projectTitle'],
            'location' => $plan['location'] ?? null,
            'status' => 'active',
            'budget' => (int) round($plan['budget']),
            'total_estimate' => (int) round($plan['totalEstimate']),
            'timeline_months' => (int) $plan['timelineMonths'],
            'started_at' => Carbon::today(),
        ]);

        foreach ($plan['phases'] as $index => $phase) {
            $projectPhase = $project->phases()->create([
                'name' => $phase['name'],
                'sort_order' => $index,
                'weight_pct' => (int) round($phase['percentComplete']),
                'progress_pct' => 0,
            ]);

            foreach ($phase['tasks'] ?? [] as $description) {
                $projectPhase->tasks()->create([
                    'description' => $description,
                    'is_done' => false,
                    'added_by' => $user->id,
                ]);
            }
        }

        return $project->load('phases.tasks');
    }

    public function assignWorker(Project $project, User $actingUser, User $worker): void
    {
        $this->authorizeOwner($project, $actingUser);

        if ($worker->role !== 'worker') {
            throw ValidationException::withMessages(['worker_id' => 'Only skilled worker accounts can be assigned.']);
        }

        $project->workers()->syncWithoutDetaching([$worker->id]);
    }

    public function unassignWorker(Project $project, User $actingUser, User $worker): void
    {
        $this->authorizeOwner($project, $actingUser);

        $project->workers()->detach($worker->id);
    }

    public function assignContractor(Project $project, User $actingUser, User $contractor): void
    {
        $this->authorizeOwner($project, $actingUser);

        if ($contractor->role !== 'contractor') {
            throw ValidationException::withMessages(['contractor_id' => 'Only contractor accounts can be assigned.']);
        }

        $project->contractors()->syncWithoutDetaching([$contractor->id]);
    }

    public function unassignContractor(Project $project, User $actingUser, User $contractor): void
    {
        $this->authorizeOwner($project, $actingUser);

        $project->contractors()->detach($contractor->id);
    }

    private function authorizeOwner(Project $project, User $actingUser): void
    {
        if ($project->user_id !== $actingUser->id) {
            throw ValidationException::withMessages(['project_id' => 'This is not your project.']);
        }
    }

    public function addPhaseTask(ProjectPhase $phase, User $actingUser, string $description): ProjectPhaseTask
    {
        $this->authorizeChecklistManager($phase, $actingUser);

        $task = $phase->tasks()->create([
            'description' => $description,
            'is_done' => false,
            'added_by' => $actingUser->id,
        ]);

        $phase->recomputeProgress();

        return $task;
    }

    public function updatePhaseTask(ProjectPhaseTask $task, User $actingUser, bool $isDone): ProjectPhaseTask
    {
        $phase = $task->phase;
        $this->authorizeChecklistManager($phase, $actingUser);

        $task->update(['is_done' => $isDone]);
        $phase->recomputeProgress();

        return $task;
    }

    public function deletePhaseTask(ProjectPhaseTask $task, User $actingUser): void
    {
        $phase = $task->phase;
        $this->authorizeChecklistManager($phase, $actingUser);

        $task->delete();
        $phase->recomputeProgress();
    }

    private function authorizeChecklistManager(ProjectPhase $phase, User $actingUser): void
    {
        $project = $phase->project;
        if (! $project->isManageableBy($actingUser)) {
            throw ValidationException::withMessages(['phase_id' => 'You are not assigned as a contractor on this project.']);
        }
    }

    /**
     * Projects where the user is an assigned contractor or worker (not the owner's own
     * dashboard — that's dashboardFor()).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function myProjectsFor(User $user): Collection
    {
        $eagerLoad = ['phases.tasks', 'workers.workerProfile', 'contractors.contractorProfile', 'user'];
        $asContractor = $user->contractorAssignments()->with($eagerLoad);
        $asWorker = $user->workerAssignments()->with($eagerLoad);

        $projects = $asContractor->get()->merge($asWorker->get())->unique('id');

        return $projects->map(fn (Project $project) => array_merge(
            $this->present($project),
            [
                'ownerName' => $project->user->name,
                'canManageChecklist' => $project->isManageableBy($user),
            ]
        ))->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function dashboardFor(User $user): array
    {
        $project = $user->projects()
            ->with(['phases.tasks', 'workers.workerProfile', 'contractors.contractorProfile'])
            ->latest('started_at')->first();

        return [
            'project' => $project ? $this->present($project) : null,
            'stats' => [
                'active' => $user->projects()->where('status', 'active')->count(),
                'completed' => $user->projects()->where('status', 'completed')->count(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Project $project): array
    {
        return [
            'id' => $project->id,
            'title' => $project->title,
            'location' => $project->location,
            'status' => $project->status,
            'budget' => $project->budget,
            'totalEstimate' => $project->total_estimate,
            'timelineMonths' => $project->timeline_months,
            'startedAt' => $project->started_at->toDateString(),
            'overallProgressPct' => $project->overallProgressPct(),
            'phases' => $project->phases->map(fn (ProjectPhase $phase) => [
                'id' => $phase->id,
                'name' => $phase->name,
                'progressPct' => $phase->progress_pct,
                'tasks' => $phase->tasks->map(fn (ProjectPhaseTask $task) => [
                    'id' => $task->id,
                    'description' => $task->description,
                    'isDone' => $task->is_done,
                ])->values(),
            ])->values(),
            'workers' => $project->workers->map(fn (User $worker) => [
                'id' => $worker->id,
                'name' => $worker->name,
                'trade' => $worker->workerProfile?->trade,
            ])->values(),
            'contractors' => $project->contractors->map(fn (User $contractor) => [
                'id' => $contractor->id,
                'name' => $contractor->name,
                'specialization' => $contractor->contractorProfile?->specialization,
                'companyName' => $contractor->contractorProfile?->company_name,
            ])->values(),
        ];
    }
}
