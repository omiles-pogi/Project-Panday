<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        return response()->json($this->projects->dashboardFor($request->user()));
    }

    public function myProjects(Request $request): JsonResponse
    {
        return response()->json($this->projects->myProjectsFor($request->user()));
    }

    public function assignWorker(AssignWorkerRequest $request, Project $project): JsonResponse
    {
        try {
            $this->projects->assignWorker($project, $request->user(), User::findOrFail($request->validated('worker_id')));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
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
            $this->projects->assignContractor($project, $request->user(), User::findOrFail($request->validated('contractor_id')));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
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
}
