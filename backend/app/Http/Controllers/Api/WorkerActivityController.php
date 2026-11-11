<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveWorkLogRequest;
use App\Models\Project;
use App\Services\WorkerActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkerActivityController extends Controller
{
    public function __construct(private readonly WorkerActivityService $activity) {}

    public function attendance(Request $request): JsonResponse
    {
        return response()->json($this->activity->attendanceFor($request->user()));
    }

    public function checkIn(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->activity->checkIn($project, $request->user()), 201);
    }

    public function checkOut(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->activity->checkOut($project, $request->user()));
    }

    public function workLogs(Request $request): JsonResponse
    {
        return response()->json($this->activity->workLogsFor($request->user()));
    }

    public function saveWorkLog(SaveWorkLogRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(function () use ($request, $project) {
            $data = $request->validated();

            return $this->activity->saveLog($project, $request->user(), $data['summary'], $data['log_date'] ?? null);
        });
    }

    public function earnings(Request $request): JsonResponse
    {
        return response()->json($this->activity->earningsFor($request->user()));
    }

    public function team(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->activity->teamActivity($project, $request->user()));
    }
}
