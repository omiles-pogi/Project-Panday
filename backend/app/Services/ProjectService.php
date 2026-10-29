<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectActivityLog;
use App\Models\ProjectContractorRequest;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Models\ProjectWorkerRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ProjectService
{
    public function __construct(private readonly NotificationService $notifications) {}

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
            'ai_materials' => $this->normalizeAiMaterials($plan['materials'] ?? []),
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

    /**
     * Keeps only the fields a material request import needs, so the stored JSON stays small and
     * predictable regardless of what else the AI plan carried.
     *
     * @param  array<int, array<string, mixed>>  $materials
     * @return array<int, array<string, mixed>>|null
     */
    private function normalizeAiMaterials(array $materials): ?array
    {
        if ($materials === []) {
            return null;
        }

        return array_values(array_map(fn (array $m) => [
            'material' => (string) $m['material'],
            'category' => $m['category'] ?? null,
            'qty' => (float) $m['qty'],
            'unit' => (string) $m['unit'],
            'unitPrice' => (float) $m['unitPrice'],
        ], $materials));
    }

    /**
     * Invites a worker to the project rather than assigning them outright — they must accept
     * before `project_workers` gets a row. See respondToWorkerRequest(). The project owner can
     * do this, and so can a contractor already assigned to manage the project (building out
     * their own slice of the team), which is why this takes the acting user's name for the
     * notification rather than assuming it's always the homeowner.
     *
     * @return array<string, mixed>
     */
    public function assignWorker(Project $project, User $actingUser, User $worker): array
    {
        $this->authorizeTeamManager($project, $actingUser);

        if ($worker->role !== 'worker') {
            throw ValidationException::withMessages(['worker_id' => 'Only skilled worker accounts can be assigned.']);
        }

        if ($project->hasAssignedWorker($worker)) {
            throw ValidationException::withMessages(['worker_id' => 'This worker is already on the project.']);
        }

        if ($this->hasPendingRequest($project, $worker)) {
            throw ValidationException::withMessages(['worker_id' => 'There is already a pending request for this worker.']);
        }

        $request = $project->workerRequests()->create([
            'worker_id' => $worker->id,
            'initiated_by' => 'homeowner',
            'invited_by_user_id' => $actingUser->id,
            'status' => 'pending',
        ]);

        $this->notifications->send(
            $worker,
            'worker_invite',
            'New team invite',
            "{$actingUser->name} invited you to join \"{$project->title}\".",
            ['projectId' => $project->id, 'projectTitle' => $project->title, 'requestId' => $request->id]
        );

        return $this->presentWorkerRequest($request);
    }

    /**
     * A worker-initiated counterpart to assignWorker() — same pending/approved/rejected
     * lifecycle, just started from the other side and awaiting the homeowner's response.
     *
     * @return array<string, mixed>
     */
    public function applyToProject(Project $project, User $worker): array
    {
        if ($worker->role !== 'worker') {
            throw ValidationException::withMessages(['worker_id' => 'Only skilled worker accounts can apply.']);
        }

        if ($project->status !== 'active') {
            throw ValidationException::withMessages(['project_id' => 'This project is not accepting applications.']);
        }

        if ($project->hasAssignedWorker($worker)) {
            throw ValidationException::withMessages(['worker_id' => 'You are already assigned to this project.']);
        }

        if ($this->hasPendingRequest($project, $worker)) {
            throw ValidationException::withMessages(['worker_id' => 'You already have a pending request for this project.']);
        }

        $request = $project->workerRequests()->create([
            'worker_id' => $worker->id,
            'initiated_by' => 'worker',
            'status' => 'pending',
        ]);

        $this->notifications->send(
            $project->user,
            'worker_application',
            'New project application',
            "{$worker->name} applied to join \"{$project->title}\".",
            [
                'projectId' => $project->id,
                'projectTitle' => $project->title,
                'requestId' => $request->id,
                'workerId' => $worker->id,
                'workerName' => $worker->name,
            ]
        );

        return $this->presentWorkerRequest($request);
    }

    /**
     * Resolves either direction of ProjectWorkerRequest — an invite (only the invited worker
     * may respond) or an application (only the project owner may respond). Accepting is what
     * actually creates the project_workers row; declining never touches it.
     *
     * @return array<string, mixed>
     */
    public function respondToWorkerRequest(ProjectWorkerRequest $request, User $actingUser, bool $accept): array
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages(['request_id' => 'This request has already been resolved.']);
        }

        $project = $request->project;
        $worker = $request->worker;

        if ($request->isHomeownerInitiated()) {
            if ($actingUser->id !== $request->worker_id) {
                throw ValidationException::withMessages(['request_id' => 'This invite is not yours to respond to.']);
            }
        } elseif ($actingUser->id !== $project->user_id) {
            throw ValidationException::withMessages(['request_id' => 'This application is not yours to respond to.']);
        }

        $request->update(['status' => $accept ? 'approved' : 'rejected']);

        if ($accept) {
            $project->workers()->syncWithoutDetaching([$worker->id]);
        }

        if ($request->isHomeownerInitiated()) {
            // The worker responded to whoever actually sent the invite — the homeowner, or a
            // contractor managing the project — falling back to the owner for older rows from
            // before invites tracked who sent them.
            $inviter = $request->invited_by_user_id ? User::find($request->invited_by_user_id) : null;
            $this->notifications->send(
                $inviter ?? $project->user,
                'worker_invite_response',
                $accept ? 'Invite accepted' : 'Invite declined',
                $accept
                    ? "{$worker->name} accepted your invite to \"{$project->title}\"."
                    : "{$worker->name} declined your invite to \"{$project->title}\".",
                ['projectId' => $project->id, 'projectTitle' => $project->title, 'requestId' => $request->id, 'workerId' => $worker->id]
            );
        } else {
            // The homeowner responded to the worker's application — notify the worker.
            $this->notifications->send(
                $worker,
                'worker_application_decision',
                $accept ? 'Application approved' : 'Application rejected',
                $accept
                    ? "Your application to \"{$project->title}\" was approved."
                    : "Your application to \"{$project->title}\" was rejected.",
                ['projectId' => $project->id, 'projectTitle' => $project->title, 'requestId' => $request->id]
            );
        }

        return $this->presentWorkerRequest($request);
    }

    private function hasPendingRequest(Project $project, User $worker): bool
    {
        return $project->workerRequests()->where('worker_id', $worker->id)->where('status', 'pending')->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function presentWorkerRequest(ProjectWorkerRequest $request): array
    {
        return [
            'id' => $request->id,
            'projectId' => $request->project_id,
            'workerId' => $request->worker_id,
            'initiatedBy' => $request->initiated_by,
            'status' => $request->status,
        ];
    }

    public function unassignWorker(Project $project, User $actingUser, User $worker): void
    {
        $this->authorizeOwner($project, $actingUser);

        $project->workers()->detach($worker->id);
    }

    /**
     * Invites a contractor rather than assigning them outright — the contractor-side mirror of
     * assignWorker(). Only the homeowner sends these (unlike worker invites, there's no "a
     * contractor invites another contractor" concept here).
     *
     * @return array<string, mixed>
     */
    public function assignContractor(Project $project, User $actingUser, User $contractor): array
    {
        $this->authorizeOwner($project, $actingUser);

        if ($contractor->role !== 'contractor') {
            throw ValidationException::withMessages(['contractor_id' => 'Only contractor accounts can be assigned.']);
        }

        if ($project->hasAssignedContractor($contractor)) {
            throw ValidationException::withMessages(['contractor_id' => 'This contractor is already on the project.']);
        }

        if ($this->hasPendingContractorRequest($project, $contractor)) {
            throw ValidationException::withMessages(['contractor_id' => 'There is already a pending request for this contractor.']);
        }

        $request = $project->contractorRequests()->create([
            'contractor_id' => $contractor->id,
            'initiated_by' => 'homeowner',
            'status' => 'pending',
        ]);

        $this->notifications->send(
            $contractor,
            'contractor_invite',
            'New project invite',
            "{$actingUser->name} invited you to manage \"{$project->title}\".",
            ['projectId' => $project->id, 'projectTitle' => $project->title, 'requestId' => $request->id]
        );

        return $this->presentContractorRequest($request);
    }

    /**
     * A contractor-initiated counterpart to assignContractor() — the contractor's proposal
     * (quote, estimated timeline, message) awaits the homeowner's approval.
     *
     * @return array<string, mixed>
     */
    public function applyAsContractor(
        Project $project,
        User $contractor,
        ?int $quoteAmount,
        ?int $estimatedDays,
        ?string $message
    ): array {
        if ($contractor->role !== 'contractor') {
            throw ValidationException::withMessages(['contractor_id' => 'Only contractor accounts can apply.']);
        }

        if ($project->status !== 'active') {
            throw ValidationException::withMessages(['project_id' => 'This project is not accepting applications.']);
        }

        if ($project->hasAssignedContractor($contractor)) {
            throw ValidationException::withMessages(['contractor_id' => 'You are already assigned to this project.']);
        }

        if ($this->hasPendingContractorRequest($project, $contractor)) {
            throw ValidationException::withMessages(['contractor_id' => 'You already have a pending request for this project.']);
        }

        $request = $project->contractorRequests()->create([
            'contractor_id' => $contractor->id,
            'initiated_by' => 'contractor',
            'status' => 'pending',
            'quote_amount' => $quoteAmount,
            'estimated_days' => $estimatedDays,
            'message' => $message,
        ]);

        $this->notifications->send(
            $project->user,
            'contractor_application',
            'New contractor application',
            "{$contractor->name} applied to manage \"{$project->title}\".",
            [
                'projectId' => $project->id,
                'projectTitle' => $project->title,
                'requestId' => $request->id,
                'contractorId' => $contractor->id,
                'contractorName' => $contractor->name,
            ]
        );

        return $this->presentContractorRequest($request);
    }

    /**
     * Resolves either direction of ProjectContractorRequest — mirrors respondToWorkerRequest().
     *
     * @return array<string, mixed>
     */
    public function respondToContractorRequest(ProjectContractorRequest $request, User $actingUser, bool $accept): array
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages(['request_id' => 'This request has already been resolved.']);
        }

        $project = $request->project;
        $contractor = $request->contractor;

        if ($request->isHomeownerInitiated()) {
            if ($actingUser->id !== $request->contractor_id) {
                throw ValidationException::withMessages(['request_id' => 'This invite is not yours to respond to.']);
            }
        } elseif ($actingUser->id !== $project->user_id) {
            throw ValidationException::withMessages(['request_id' => 'This application is not yours to respond to.']);
        }

        $request->update(['status' => $accept ? 'approved' : 'rejected']);

        if ($accept) {
            $project->contractors()->syncWithoutDetaching([$contractor->id]);
        }

        if ($request->isHomeownerInitiated()) {
            $this->notifications->send(
                $project->user,
                'contractor_invite_response',
                $accept ? 'Invite accepted' : 'Invite declined',
                $accept
                    ? "{$contractor->name} accepted your invite to \"{$project->title}\"."
                    : "{$contractor->name} declined your invite to \"{$project->title}\".",
                ['projectId' => $project->id, 'projectTitle' => $project->title, 'requestId' => $request->id, 'contractorId' => $contractor->id]
            );
        } else {
            $this->notifications->send(
                $contractor,
                'contractor_application_decision',
                $accept ? 'Application approved' : 'Application rejected',
                $accept
                    ? "Your application to \"{$project->title}\" was approved."
                    : "Your application to \"{$project->title}\" was rejected.",
                ['projectId' => $project->id, 'projectTitle' => $project->title, 'requestId' => $request->id]
            );
        }

        return $this->presentContractorRequest($request);
    }

    private function hasPendingContractorRequest(Project $project, User $contractor): bool
    {
        return $project->contractorRequests()->where('contractor_id', $contractor->id)->where('status', 'pending')->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function presentContractorRequest(ProjectContractorRequest $request): array
    {
        return [
            'id' => $request->id,
            'projectId' => $request->project_id,
            'contractorId' => $request->contractor_id,
            'initiatedBy' => $request->initiated_by,
            'status' => $request->status,
            'quoteAmount' => $request->quote_amount,
            'estimatedDays' => $request->estimated_days,
            'message' => $request->message,
        ];
    }

    /**
     * Active projects this contractor isn't already assigned to — mirrors availableFor(), the
     * worker-side browse, with a proposal (quote/timeline/message) instead of a bare apply.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function availableForContractors(User $user): Collection
    {
        $assignedIds = $user->contractorAssignments()->pluck('projects.id');

        $myRequestsByProject = $user->contractorRequests()
            ->latest()
            ->get()
            ->unique('project_id')
            ->keyBy('project_id');

        return Project::query()
            ->where('status', 'active')
            ->whereNotIn('id', $assignedIds)
            ->with(['user', 'phases', 'workers', 'contractors'])
            ->latest('started_at')
            ->get()
            ->map(function (Project $project) use ($myRequestsByProject) {
                /** @var ProjectContractorRequest|null $myRequest */
                $myRequest = $myRequestsByProject->get($project->id);

                return [
                    'id' => $project->id,
                    'title' => $project->title,
                    'location' => $project->location,
                    'budget' => $project->budget,
                    'totalEstimate' => $project->total_estimate,
                    'timelineMonths' => $project->timeline_months,
                    'startedAt' => $project->started_at->toDateString(),
                    'overallProgressPct' => $project->overallProgressPct(),
                    'ownerName' => $project->user->name,
                    'workerCount' => $project->workers->count(),
                    'contractorCount' => $project->contractors->count(),
                    'myApplicationStatus' => $myRequest && $myRequest->initiated_by === 'contractor' ? $myRequest->status : null,
                ];
            })
            ->values();
    }

    public function unassignContractor(Project $project, User $actingUser, User $contractor): void
    {
        $this->authorizeOwner($project, $actingUser);

        $project->contractors()->detach($contractor->id);
    }

    /** Cascades at the DB level (phases, tasks, worker/contractor assignments all
     * cascadeOnDelete) — this is what makes the project disappear from assigned
     * contractors' and workers' dashboards too. */
    public function deleteProject(Project $project, User $actingUser): void
    {
        $this->authorizeOwner($project, $actingUser);

        $project->delete();
    }

    private function authorizeOwner(Project $project, User $actingUser): void
    {
        if ($project->user_id !== $actingUser->id) {
            throw ValidationException::withMessages(['project_id' => 'This is not your project.']);
        }
    }

    private function authorizeTeamManager(Project $project, User $actingUser): void
    {
        if (! $project->canManageTeam($actingUser)) {
            throw ValidationException::withMessages(['project_id' => 'You cannot manage this project\'s team.']);
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

        // One log row per checklist change, carrying the project's overall % immediately after
        // this change — this is what lets the homeowner see "what was the progress on that day"
        // rather than only today's current snapshot.
        $project = $phase->project;
        $project->load('phases');
        ProjectActivityLog::create([
            'project_id' => $project->id,
            'phase_name' => $phase->name,
            'task_description' => $task->description,
            'is_done' => $isDone,
            'overall_progress_pct' => $project->overallProgressPct(),
        ]);

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
    public function dashboardFor(User $user, ?int $projectId = null): array
    {
        $query = $user->projects()->with(['phases.tasks', 'workers.workerProfile', 'contractors.contractorProfile']);

        // A specific project the homeowner picked from their list; falls back to the most
        // recently started one (and silently ignores an id that isn't theirs, same as "none").
        $project = $projectId
            ? $query->whereKey($projectId)->first()
            : $query->latest('started_at')->first();

        return [
            'project' => $project ? $this->present($project) : null,
            'stats' => [
                'active' => $user->projects()->where('status', 'active')->count(),
                'completed' => $user->projects()->where('status', 'completed')->count(),
            ],
        ];
    }

    /**
     * All projects the homeowner owns, newest first — lightweight, for a project picker.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function listFor(User $user): Collection
    {
        return $user->projects()
            ->latest('started_at')
            ->get()
            ->map(fn (Project $project) => [
                'id' => $project->id,
                'title' => $project->title,
                'status' => $project->status,
                'startedAt' => $project->started_at->toDateString(),
                'overallProgressPct' => $project->overallProgressPct(),
            ]);
    }

    /**
     * Active projects this user isn't already assigned to as a worker — lets a worker browse
     * real homeowner projects and apply, instead of a static sample list. Each project carries
     * the worker's own latest request status (if any) so the UI can show "Apply" vs. "Pending" /
     * "Approved" / "Rejected" instead of letting them fire off duplicate applications blindly.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function availableFor(User $user): Collection
    {
        $assignedIds = $user->workerAssignments()->pluck('projects.id');

        $myRequestsByProject = $user->workerRequests()
            ->latest()
            ->get()
            ->unique('project_id')
            ->keyBy('project_id');

        return Project::query()
            ->where('status', 'active')
            ->whereNotIn('id', $assignedIds)
            ->with(['user', 'phases', 'workers', 'contractors'])
            ->latest('started_at')
            ->get()
            ->map(function (Project $project) use ($myRequestsByProject) {
                /** @var ProjectWorkerRequest|null $myRequest */
                $myRequest = $myRequestsByProject->get($project->id);

                return [
                    'id' => $project->id,
                    'title' => $project->title,
                    'location' => $project->location,
                    'budget' => $project->budget,
                    'totalEstimate' => $project->total_estimate,
                    'timelineMonths' => $project->timeline_months,
                    'startedAt' => $project->started_at->toDateString(),
                    'overallProgressPct' => $project->overallProgressPct(),
                    'ownerName' => $project->user->name,
                    'workerCount' => $project->workers->count(),
                    'contractorCount' => $project->contractors->count(),
                    'myApplicationStatus' => $myRequest && $myRequest->initiated_by === 'worker' ? $myRequest->status : null,
                ];
            })
            ->values();
    }

    /**
     * Checklist activity grouped by the day it happened, newest day first — each day carries the
     * project's overall progress as of its last change that day, so a homeowner can see what the
     * progress was on any given day, not just where it stands right now.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function activityLogFor(Project $project, User $actingUser): Collection
    {
        if (! $project->isVisibleTo($actingUser)) {
            throw ValidationException::withMessages(['project_id' => 'You cannot view this project.']);
        }

        return $project->activityLogs
            ->groupBy(fn (ProjectActivityLog $log) => $log->created_at->toDateString())
            ->map(fn (Collection $dayLogs, string $date) => [
                'date' => $date,
                'overallProgressPct' => $dayLogs->last()->overall_progress_pct,
                'entries' => $dayLogs->map(fn (ProjectActivityLog $log) => [
                    'phaseName' => $log->phase_name,
                    'taskDescription' => $log->task_description,
                    'isDone' => $log->is_done,
                    'time' => $log->created_at->format('g:i A'),
                ])->values(),
            ])
            ->sortByDesc('date')
            ->values();
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
