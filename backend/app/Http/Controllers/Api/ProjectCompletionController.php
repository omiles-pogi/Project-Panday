<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RequestProjectCorrectionsRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Services\ProjectCompletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectCompletionController extends Controller
{
    public function __construct(private readonly ProjectCompletionService $completion) {}

    /** Checks every task in one phase of the project's checklist. */
    public function checkAll(Request $request, Project $project, ProjectPhase $phase): JsonResponse
    {
        if ($phase->project_id !== $project->id) {
            return response()->json(['error' => 'Phase does not belong to this project.'], 404);
        }

        return $this->attempt(fn () => $this->completion->checkAll($project, $phase, $request->user()));
    }

    public function uncheckAll(Request $request, Project $project, ProjectPhase $phase): JsonResponse
    {
        if ($phase->project_id !== $project->id) {
            return response()->json(['error' => 'Phase does not belong to this project.'], 404);
        }

        return $this->attempt(fn () => $this->completion->uncheckAll($project, $phase, $request->user()));
    }

    /** The contractor submits the finished project to the homeowner. */
    public function submit(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->completion->submit($project, $request->user()));
    }

    public function confirm(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->completion->confirm($project, $request->user()));
    }

    public function requestCorrections(RequestProjectCorrectionsRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->completion->requestCorrections($project, $request->user(), $request->validated()['note']));
    }
}
