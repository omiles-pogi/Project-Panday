<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\ScheduleAlertService;
use App\Services\TimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectTimelineController extends Controller
{
    public function __construct(
        private readonly TimelineService $timeline,
        private readonly ScheduleAlertService $alerts,
    ) {}

    public function show(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(function () use ($request, $project) {
            $timeline = $this->timeline->timelineFor($project, $request->user());

            // Opening the calendar also checks for a slip, so alerts still go out where no scheduler runs.
            $this->alerts->evaluate($project, $timeline['overall']);

            return $timeline;
        });
    }
}
