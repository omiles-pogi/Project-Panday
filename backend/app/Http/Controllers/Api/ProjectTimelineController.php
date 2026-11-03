<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\TimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProjectTimelineController extends Controller
{
    public function __construct(private readonly TimelineService $timeline) {}

    public function show(Request $request, Project $project): JsonResponse
    {
        try {
            $timeline = $this->timeline->timelineFor($project, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($timeline);
    }
}
