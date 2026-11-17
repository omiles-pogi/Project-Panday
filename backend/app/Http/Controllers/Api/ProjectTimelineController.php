<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProjectTimelineRequest;
use App\Models\Project;
use App\Services\ScheduleAlertService;
use App\Services\TimelineService;
use Illuminate\Http\JsonResponse;

class ProjectTimelineController extends Controller
{
    public function __construct(
        private readonly TimelineService $timeline,
        private readonly ScheduleAlertService $alerts,
    ) {}

    public function show(ProjectTimelineRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(function () use ($request, $project) {
            $timeline = $this->timeline->timelineFor($project, $request->user(), $request->boolean('saved_only'));

            // Opening the calendar also checks for a slip, so alerts still go out where no scheduler runs.
            $this->alerts->evaluate($project, $timeline['overall']);

            return $timeline;
        });
    }
}
