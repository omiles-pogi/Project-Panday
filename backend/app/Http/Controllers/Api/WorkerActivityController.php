<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveWorkLogRequest;
use App\Models\Project;
use App\Services\WorkerActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WorkerActivityController extends Controller
{
    public function __construct(private readonly WorkerActivityService $activity) {}

    public function attendance(Request $request): JsonResponse
    {
        return response()->json($this->activity->attendanceFor($request->user()));
    }

    public function checkIn(Request $request, Project $project): JsonResponse
    {
        try {
            return response()->json($this->activity->checkIn($project, $request->user()), 201);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function checkOut(Request $request, Project $project): JsonResponse
    {
        try {
            return response()->json($this->activity->checkOut($project, $request->user()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function workLogs(Request $request): JsonResponse
    {
        return response()->json($this->activity->workLogsFor($request->user()));
    }

    public function saveWorkLog(SaveWorkLogRequest $request, Project $project): JsonResponse
    {
        try {
            $data = $request->validated();

            return response()->json($this->activity->saveLog($project, $request->user(), $data['summary'], $data['log_date'] ?? null));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function earnings(Request $request): JsonResponse
    {
        return response()->json($this->activity->earningsFor($request->user()));
    }

    public function team(Request $request, Project $project): JsonResponse
    {
        try {
            return response()->json($this->activity->teamActivity($project, $request->user()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
