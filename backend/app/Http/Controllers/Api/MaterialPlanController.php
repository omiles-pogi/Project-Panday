<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReviewMaterialPlanRequest;
use App\Http\Requests\UpdateMaterialSettingsRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Services\MaterialPlanService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Phase-by-phase material planning — see MaterialPlanService. */
class MaterialPlanController extends Controller
{
    public function __construct(private readonly MaterialPlanService $plans) {}

    public function show(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->plans->planFor($project, $request->user()));
    }

    public function review(ReviewMaterialPlanRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->plans->review($project, $request->user(), $request->validated('lines')));
    }

    public function requestPhase(Request $request, Project $project, ProjectPhase $phase): JsonResponse
    {
        if ($phase->project_id !== $project->id) {
            return response()->json(['error' => 'Phase does not belong to this project.'], 404);
        }

        return $this->attempt(fn () => $this->plans->requestForPhase($project, $request->user(), $phase), 201);
    }

    public function settings(UpdateMaterialSettingsRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->plans->setAutoApprove($project, $request->user(), $request->boolean('auto_approve_materials')));
    }

    private function attempt(Closure $action, int $status = 200): JsonResponse
    {
        try {
            return response()->json($action(), $status);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
