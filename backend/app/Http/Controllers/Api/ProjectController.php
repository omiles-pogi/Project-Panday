<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddBudgetRequest;
use App\Http\Requests\ApplyAsContractorRequest;
use App\Http\Requests\AssignContractorRequest;
use App\Http\Requests\AssignWorkerRequest;
use App\Http\Requests\SetWageRequest;
use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use App\Support\Wage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $project = $this->projects->createFromPlan($request->user(), $request->validated());

        return response()->json($project, 201);
    }

    /** "New Project": adds a "not started yet" placeholder (or returns the one already waiting). */
    public function storeDraft(Request $request): JsonResponse
    {
        $project = $this->projects->startDraft($request->user());

        return response()->json([
            'id' => $project->id,
            'title' => $project->title,
            'status' => $project->status,
            'startedAt' => $project->started_at->toDateString(),
            'overallProgressPct' => 0,
            // False when this is the placeholder they already had waiting — the app resumes its chat
            // rather than wiping it.
            'created' => $project->wasRecentlyCreated,
        ], $project->wasRecentlyCreated ? 201 : 200);
    }

    /** Approves an AI plan into a "not started yet" placeholder, starting it. */
    public function activate(StoreProjectRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->activateFromPlan($project, $request->user(), $request->validated()));
    }

    public function dashboard(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');

        return response()->json($this->projects->dashboardFor($request->user(), $projectId ? (int) $projectId : null));
    }

    /** Adds to the homeowner's budget — for when the estimate has gone past it. */
    public function addBudget(AddBudgetRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->addBudget($project, $request->user(), $request->validated('amount')));
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->projects->listFor($request->user()));
    }

    public function available(Request $request): JsonResponse
    {
        return response()->json($this->projects->availableFor($request->user()));
    }

    public function availableForContractors(Request $request): JsonResponse
    {
        return response()->json($this->projects->availableForContractors($request->user()));
    }

    public function applyAsWorker(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->applyToProject($project, $request->user()), 201);
    }

    public function applyAsContractor(ApplyAsContractorRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->applyAsContractor(
            $project,
            $request->user(),
            $request->validated('quote_amount'),
            $request->validated('estimated_days'),
            $request->validated('message')
        ), 201);
    }

    public function destroy(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(function () use ($request, $project) {
            $this->projects->deleteProject($project, $request->user());

            return null;
        }, 204);
    }

    public function myProjects(Request $request): JsonResponse
    {
        return response()->json($this->projects->myProjectsFor($request->user()));
    }

    public function assignWorker(AssignWorkerRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->assignWorker($project, $request->user(), User::findOrFail($request->validated('worker_id'))), 201);
    }

    public function unassignWorker(Request $request, Project $project, User $worker): JsonResponse
    {
        return $this->attempt(function () use ($request, $project, $worker) {
            $this->projects->unassignWorker($project, $request->user(), $worker);

            return null;
        }, 204);
    }

    public function assignContractor(AssignContractorRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->assignContractor($project, $request->user(), User::findOrFail($request->validated('contractor_id'))), 201);
    }

    public function unassignContractor(Request $request, Project $project, User $contractor): JsonResponse
    {
        return $this->attempt(function () use ($request, $project, $contractor) {
            $this->projects->unassignContractor($project, $request->user(), $contractor);

            return null;
        }, 204);
    }

    public function setWorkerWage(SetWageRequest $request, Project $project, User $worker): JsonResponse
    {
        return $this->setWage($request, $project, $worker, 'worker');
    }

    public function setContractorWage(SetWageRequest $request, Project $project, User $contractor): JsonResponse
    {
        return $this->setWage($request, $project, $contractor, 'contractor');
    }

    private function setWage(SetWageRequest $request, Project $project, User $member, string $role): JsonResponse
    {
        return $this->attempt(fn () => ['wage' => $this->projects->setWage(
            $project,
            $request->user(),
            $member,
            $role,
            $request->validated('amount'),
            $request->validated('unit') ?? Wage::PER_DAY,
            $request->validated('days'),
            $request->boolean('automatic')
        )]);
    }

    public function activityLog(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->activityLogFor($project, $request->user()));
    }
}
