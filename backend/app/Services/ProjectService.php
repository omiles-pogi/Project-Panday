<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectActivityLog;
use App\Models\ProjectContractorRequest;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Models\ProjectWorkerRequest;
use App\Models\User;
use App\Support\Wage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectService
{
    public const DRAFT_TITLE = 'New Project';

    public function __construct(
        private readonly NotificationService $notifications,
        private readonly TimelineService $timeline,
        private readonly ProjectBudgetService $budgets,
        private readonly ConstructionPlanService $plans,
        private readonly WageService $wages,
        private readonly EstimateAdjustmentService $estimates,
    ) {}

    /**
     * @param  array<string, mixed>  $plan  A validated construction plan payload (see StoreProjectRequest).
     */
    public function createFromPlan(User $user, array $plan): Project
    {
        $project = $user->projects()->create($this->planAttributes($plan) + [
            'status' => 'active',
            'started_at' => Carbon::today(),
        ]);

        return $this->addPlanPhases($project, $plan);
    }

    /**
     * Tapping "New Project" adds an empty placeholder to the homeowner's projects right away — "not
     * started yet" — so the AI chat for it has a project of its own to belong to instead of floating
     * as an unsaved draft next to their real ones. It becomes a real project once its plan is
     * approved (see activateFromPlan()). Only one placeholder exists at a time: asking again resumes
     * the one they already have rather than piling up blanks.
     */
    public function startDraft(User $user): Project
    {
        return $user->projects()->where('status', 'not_started')->latest('id')->first()
            ?? $user->projects()->create([
                'title' => self::DRAFT_TITLE,
                'status' => 'not_started',
                'budget' => 0,
                'total_estimate' => 0,
                'timeline_months' => 0,
                'started_at' => Carbon::today(),
            ]);
    }

    /**
     * Approving a plan for a "not started yet" placeholder: fills it in and starts it, instead of
     * creating a second project next to it.
     *
     * @param  array<string, mixed>  $plan  A validated construction plan payload (see StoreProjectRequest).
     */
    public function activateFromPlan(Project $project, User $actingUser, array $plan): Project
    {
        $this->authorizeOwner($project, $actingUser);

        if ($project->status !== 'not_started') {
            throw ValidationException::withMessages(['project_id' => 'This project has already been started.']);
        }

        return DB::transaction(function () use ($project, $plan) {
            $project->update($this->planAttributes($plan) + [
                'status' => 'active',
                'started_at' => Carbon::today(),
            ]);

            return $this->addPlanPhases($project, $plan);
        });
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function planAttributes(array $plan): array
    {
        // A client can edit the proposal. Recheck supplier links at approval too, so a forged
        // supplier name or a now-unavailable listing never becomes a verified saved price.
        $plan = $this->plans->applySupplierData($plan, $this->plans->normalizeSelections($plan['supplierSelections'] ?? []));
        $materials = $this->normalizeAiMaterials($plan['materials'] ?? []);
        $total = ! empty($plan['budgetBreakdown'])
            ? (int) round(array_sum(array_column($plan['budgetBreakdown'], 'amount')))
            : (int) round($plan['totalEstimate']);

        return [
            'title' => $plan['projectTitle'],
            'location' => $plan['location'] ?? null,
            'budget' => (int) round($plan['budget']),
            'total_estimate' => $total,
            'timeline_months' => (int) $plan['timelineMonths'],
            'ai_materials' => $materials,
            'approved_plan' => array_replace($plan, [
                'budget' => (int) round($plan['budget']),
                'location' => (string) ($plan['location'] ?? ''),
                'totalEstimate' => $total,
                'materials' => $materials ?? [],
            ]),
        ];
    }

    /**
     * @param  array<string, mixed>  $plan
     */
    private function addPlanPhases(Project $project, array $plan): Project
    {
        foreach ($plan['phases'] as $index => $phase) {
            $projectPhase = $project->phases()->create([
                'name' => $phase['name'],
                'sort_order' => $index,
                'weight_pct' => (int) round($phase['percentComplete']),
                'progress_pct' => 0,
                'duration_weeks' => isset($phase['durationWeeks']) ? (int) $phase['durationWeeks'] : null,
            ]);

            foreach ($phase['tasks'] ?? [] as $description) {
                $projectPhase->tasks()->create([
                    'description' => $description,
                    'is_done' => false,
                    'added_by' => $project->user_id,
                ]);
            }
        }

        // Lay the proposed phases out on the calendar right away, so the schedule is fixed from the
        // day the plan is approved rather than drifting with whenever someone first opens it.
        $this->timeline->schedule($project);

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
            // Which supplier listing the homeowner's plan was priced from, so the contractor's
            // material request starts from that supplier instead of whoever is cheapest.
            'supplierProductId' => (int) ($m['supplierProductId'] ?? 0),
            'supplierName' => $m['supplierName'] ?? null,
            // The phase it's first needed in, so materials can be ordered phase by phase on the schedule.
            'phase' => (string) ($m['phase'] ?? ''),
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
        $this->requireStarted($project);

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
            // They arrive with a wage already worked out (their own minimum daily wage × the project's days).
            $this->wages->syncAutoWages($project, [$worker->id]);
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
        $this->requireStarted($project);

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
            // A contractor who applied with a quote starts out agreed at that quote as a fixed fee;
            // the homeowner can still change it. An invite has no quote, so the fee is worked out from
            // the plan instead (WageService) — and the other automatic fees are re-split for the new head count.
            $project->contractors()->syncWithoutDetaching(
                $request->quote_amount
                    ? [$contractor->id => ['wage_amount' => $request->quote_amount, 'wage_unit' => Wage::FIXED, 'wage_days' => null, 'wage_auto' => false]]
                    : [$contractor->id]
            );
            $this->wages->syncAutoWages($project, [$contractor->id]);
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
        $this->wages->syncAutoWages($project, fillMissing: false);
    }

    /** Cascades at the DB level (phases, tasks, worker/contractor assignments all
     * cascadeOnDelete) — this is what makes the project disappear from assigned
     * contractors' and workers' dashboards too. */
    public function deleteProject(Project $project, User $actingUser): void
    {
        $this->authorizeOwner($project, $actingUser);

        $project->delete();
    }

    /**
     * Raises the homeowner's budget by `$amount` — for when the work has outgrown it. The estimate is the
     * AI's and the work's, never the homeowner's to edit, so more money is the only lever. Both copies of
     * the budget move together (the project's and the one saved with its approved plan).
     *
     * @return array<string, mixed> the project as the dashboard shows it
     */
    public function addBudget(Project $project, User $actingUser, int $amount): array
    {
        $this->authorizeOwner($project, $actingUser);
        if ($project->status === 'not_started') {
            throw ValidationException::withMessages(['project_id' => 'Finish planning this project with PandAi before setting its budget.']);
        }

        DB::transaction(function () use ($project, $amount) {
            // Locked and re-read, so two adds at once both count instead of one overwriting the other.
            $locked = Project::query()->whereKey($project->id)->lockForUpdate()->firstOrFail();
            $budget = (int) $locked->budget + $amount;

            $plan = $locked->approved_plan;
            if (is_array($plan)) {
                $plan['budget'] = $budget;
            }

            $locked->update(['budget' => $budget, 'approved_plan' => $plan]);
        });

        return $this->present(
            $project->fresh(['phases.tasks', 'workers.workerProfile', 'contractors.contractorProfile']),
            $actingUser
        );
    }

    private function authorizeOwner(Project $project, User $actingUser): void
    {
        if ($project->user_id !== $actingUser->id) {
            throw ValidationException::withMessages(['project_id' => 'This is not your project.']);
        }
    }

    /** A placeholder has no plan, phases or schedule yet — there's nothing for a team to work on. */
    private function requireStarted(Project $project): void
    {
        if ($project->status === 'not_started') {
            throw ValidationException::withMessages(['project_id' => 'Finish planning this project with PandAi before building a team.']);
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

        // Keep the original completion time when a task is re-saved as done, so "completed on" is
        // when it was first finished — the calendar replays actual progress from these timestamps.
        $task->update([
            'is_done' => $isDone,
            'completed_at' => $isDone ? ($task->completed_at ?? now()) : null,
        ]);
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

        return $projects->map(function (Project $project) use ($user) {
            $presented = $this->present($project, $user);
            $mine = collect($presented[$user->role === 'worker' ? 'workers' : 'contractors'])->firstWhere('id', $user->id);

            return array_merge($presented, [
                'ownerName' => $project->user->name,
                'canManageChecklist' => $project->isManageableBy($user),
                // The viewer's own pay on this project, so their screen doesn't have to dig it out of the team list.
                'myWage' => $mine['wage'] ?? null,
            ]);
        })->values();
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
            : $query->latest('started_at')->latest('id')->first();

        return [
            'project' => $project ? $this->present($project, $user) : null,
            'stats' => [
                'active' => $user->projects()->where('status', 'active')->count(),
                'completed' => $user->projects()->where('status', 'completed')->count(),
            ],
        ];
    }

    /** A fresh owner-only snapshot for every planner request, resolved before streaming starts. */
    public function planningContextFor(User $user, int $projectId): array
    {
        $project = $user->projects()->with(['phases.tasks', 'workers.workerProfile', 'contractors.contractorProfile'])
            ->findOrFail($projectId);

        return $this->present($project, $user);
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
            ->latest('id')
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
    private function present(Project $project, ?User $viewer = null): array
    {
        // The homeowner's estimate grows when the work outgrows the plan (unplanned materials, hiring beyond
        // the plan's labor lines), so what's left of their budget shrinks with it. Everyone else keeps seeing
        // the plan's own figure — the homeowner's money isn't theirs to see.
        $adjustment = $viewer && $project->isOwnedBy($viewer) ? $this->estimates->forProject($project) : null;

        return [
            'id' => $project->id,
            'title' => $project->title,
            'location' => $project->location,
            'status' => $project->status,
            'budget' => $project->budget,
            'totalEstimate' => $adjustment['adjustedEstimate'] ?? $project->total_estimate,
            // What the AI estimated at the start, before anything was added to it.
            'planEstimate' => $project->total_estimate,
            'estimateAdjustment' => $adjustment,
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
                // What the worker asks per day, for the people who agree their wage: the homeowner and the
                // contractors on the project (and the worker themself).
                'minDailyWage' => $viewer && ($project->isOwnedBy($viewer) || $project->hasAssignedContractor($viewer) || $viewer->id === $worker->id)
                    ? $worker->workerProfile?->min_daily_wage
                    : null,
                'wage' => $this->visibleWage($project, $viewer, 'worker', $worker),
            ])->values(),
            'contractors' => $project->contractors->map(fn (User $contractor) => [
                'id' => $contractor->id,
                'name' => $contractor->name,
                'specialization' => $contractor->contractorProfile?->specialization,
                'companyName' => $contractor->contractorProfile?->company_name,
                'wage' => $this->visibleWage($project, $viewer, 'contractor', $contractor),
            ])->values(),
            // What the whole team costs — the homeowner's number, so nobody else gets it.
            'teamWageTotal' => $viewer && $project->isOwnedBy($viewer) ? $this->teamWageTotal($project) : null,
            // The homeowner's switch for letting plan-covered material requests approve themselves.
            'autoApproveMaterials' => $viewer && $project->isOwnedBy($viewer) ? (bool) $project->auto_approve_materials : null,
            'approvedPlan' => $viewer && $project->isOwnedBy($viewer) ? $project->approved_plan : null,
            'budgetRecords' => $viewer && $project->isOwnedBy($viewer) ? $this->budgets->recordsFor($project) : null,
        ];
    }

    /**
     * A team member's wage, only to people who are meant to see it: the homeowner sees everyone's, a
     * contractor on the project sees the workers' (they manage that team) and their own, and a worker
     * sees only their own. Other contractors' fees stay between each contractor and the homeowner.
     *
     * @return array{amount: int, unit: string, days: int|null, total: int}|null
     */
    private function visibleWage(Project $project, ?User $viewer, string $role, User $member): ?array
    {
        if ($viewer === null) {
            return null;
        }

        $allowed = $project->isOwnedBy($viewer)
            || $viewer->id === $member->id
            || ($role === 'worker' && $project->hasAssignedContractor($viewer));

        return $allowed ? Wage::fromPivot($member->pivot) : null;
    }

    private function teamWageTotal(Project $project): int
    {
        return (int) $project->workers->concat($project->contractors)
            ->sum(fn (User $member) => Wage::fromPivot($member->pivot)['total'] ?? 0);
    }

    /**
     * Sets (or clears, with a null amount) what one team member is paid on this project. The
     * homeowner agrees every wage; a contractor on the project can also set their workers' — the same
     * people who can invite workers — but never a contractor's, including their own.
     *
     * @return array{amount: int, unit: string, days: int|null, total: int}|null
     */
    public function setWage(Project $project, User $actingUser, User $member, string $role, ?int $amount, string $unit, ?int $days, bool $automatic = false): ?array
    {
        if ($role === 'contractor') {
            $this->authorizeOwner($project, $actingUser);
        } else {
            $this->authorizeTeamManager($project, $actingUser);
        }

        $onProject = $role === 'contractor' ? $project->hasAssignedContractor($member) : $project->hasAssignedWorker($member);
        if (! $onProject) {
            throw ValidationException::withMessages(['member_id' => 'That person is not on this project.']);
        }

        $autoCalculated = false;
        if ($automatic) {
            $this->requireStarted($project);
            $latestAcceptance = $role === 'contractor'
                ? $project->contractorRequests()->where('contractor_id', $member->id)->where('status', 'approved')
                    ->latest('id')->first()
                : null;
            $quote = $latestAcceptance?->initiated_by === 'contractor' && $latestAcceptance->quote_amount !== null
                ? $latestAcceptance : null;
            $attributes = $role === 'worker'
                ? $this->wages->workerWage($project, $member->load('workerProfile'))
                : ($quote
                    ? ['wage_amount' => (int) $quote->quote_amount, 'wage_unit' => Wage::FIXED, 'wage_days' => null]
                    : $this->wages->contractorFee($project, $project->contractors()->count()));
            if ($attributes === null) {
                throw ValidationException::withMessages(['automatic' => 'This project needs a cost estimate before a contractor fee can be calculated.']);
            }
            $amount = $attributes['wage_amount'];
            $unit = $attributes['wage_unit'];
            $days = $attributes['wage_days'];
            // An accepted contractor quote is a recorded agreement, not a calculated estimate.
            $autoCalculated = $quote === null;
        }

        if ($amount !== null && $unit === Wage::PER_DAY && ($days === null || $days < 1)) {
            throw ValidationException::withMessages(['days' => 'Enter how many days the day rate covers.']);
        }

        $relation = $role === 'contractor' ? $project->contractors() : $project->workers();
        $relation->updateExistingPivot($member->id, [
            'wage_amount' => $amount,
            'wage_unit' => $unit,
            'wage_days' => $unit === Wage::PER_DAY ? $days : null,
            'wage_auto' => $autoCalculated,
        ]);

        $wage = Wage::fromPivot($relation->where('users.id', $member->id)->first()?->pivot);

        if ($wage !== null) {
            $this->notifications->send(
                $member,
                'wage_set',
                'Your wage was set',
                "{$actingUser->name} set your wage on \"{$project->title}\" to ".self::describeWage($wage).'.',
                ['projectId' => $project->id, 'projectTitle' => $project->title]
            );
        }

        return $wage;
    }

    /** @param  array{amount: int, unit: string, days: int|null, total: int}  $wage */
    private static function describeWage(array $wage): string
    {
        $peso = '₱'.number_format($wage['amount']);

        return $wage['unit'] === Wage::FIXED
            ? "{$peso} fixed"
            : "{$peso}/day × {$wage['days']} days = ₱".number_format($wage['total']);
    }
}
