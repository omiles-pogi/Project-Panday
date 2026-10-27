<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApplyAsContractorRequest;
use App\Http\Requests\AssignContractorRequest;
use App\Http\Requests\AssignWorkerRequest;
use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProjectController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $project = $this->projects->createFromPlan($request->user(), $request->validated());

        return response()->json($project, 201);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');

        return response()->json($this->projects->dashboardFor($request->user(), $projectId ? (int) $projectId : null));
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
        try {
            $workerRequest = $this->projects->applyToProject($project, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($workerRequest, 201);
    }

    public function applyAsContractor(ApplyAsContractorRequest $request, Project $project): JsonResponse
    {
        try {
            $contractorRequest = $this->projects->applyAsContractor(
                $project,
                $request->user(),
                $request->validated('quote_amount'),
                $request->validated('estimated_days'),
                $request->validated('message')
            );
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($contractorRequest, 201);
    }

    public function destroy(Request $request, Project $project): JsonResponse
    {
        try {
            $this->projects->deleteProject($project, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
    }

    public function myProjects(Request $request): JsonResponse
    {
        return response()->json($this->projects->myProjectsFor($request->user()));
    }

    public function assignWorker(AssignWorkerRequest $request, Project $project): JsonResponse
    {
        try {
            $workerRequest = $this->projects->assignWorker($project, $request->user(), User::findOrFail($request->validated('worker_id')));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($workerRequest, 201);
    }

    public function unassignWorker(Request $request, Project $project, User $worker): JsonResponse
    {
        try {
            $this->projects->unassignWorker($project, $request->user(), $worker);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
    }

    public function assignContractor(AssignContractorRequest $request, Project $project): JsonResponse
    {
        try {
            $contractorRequest = $this->projects->assignContractor($project, $request->user(), User::findOrFail($request->validated('contractor_id')));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($contractorRequest, 201);
    }

    public function unassignContractor(Request $request, Project $project, User $contractor): JsonResponse
    {
        try {
            $this->projects->unassignContractor($project, $request->user(), $contractor);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
    }

    public function activityLog(Request $request, Project $project): JsonResponse
    {
        try {
            $log = $this->projects->activityLogFor($project, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($log);
    }
}
