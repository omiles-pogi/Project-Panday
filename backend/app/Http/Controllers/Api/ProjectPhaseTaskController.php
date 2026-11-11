<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddPhaseTaskRequest;
use App\Http\Requests\UpdatePhaseTaskRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectPhaseTaskController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function store(AddPhaseTaskRequest $request, Project $project, ProjectPhase $phase): JsonResponse
    {
        if ($phase->project_id !== $project->id) {
            return response()->json(['error' => 'Phase does not belong to this project.'], 404);
        }

        return $this->attempt(fn () => $this->projects->addPhaseTask($phase, $request->user(), $request->validated('description')), 201);
    }

    public function update(UpdatePhaseTaskRequest $request, Project $project, ProjectPhase $phase, ProjectPhaseTask $task): JsonResponse
    {
        if ($phase->project_id !== $project->id || $task->project_phase_id !== $phase->id) {
            return response()->json(['error' => 'Task does not belong to this phase.'], 404);
        }

        return $this->attempt(fn () => $this->projects->updatePhaseTask($task, $request->user(), $request->validated('is_done')));
    }

    public function destroy(Request $request, Project $project, ProjectPhase $phase, ProjectPhaseTask $task): JsonResponse
    {
        if ($phase->project_id !== $project->id || $task->project_phase_id !== $phase->id) {
            return response()->json(['error' => 'Task does not belong to this phase.'], 404);
        }

        return $this->attempt(function () use ($request, $task) {
            $this->projects->deletePhaseTask($task, $request->user());

            return null;
        }, 204);
    }
}
