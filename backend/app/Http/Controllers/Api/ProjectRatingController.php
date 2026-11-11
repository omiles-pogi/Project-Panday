<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RateProjectTeamMemberRequest;
use App\Models\Project;
use App\Services\ProjectRatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectRatingController extends Controller
{
    public function __construct(private readonly ProjectRatingService $ratings) {}

    public function show(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->ratings->statusFor($project, $request->user()));
    }

    public function store(RateProjectTeamMemberRequest $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->ratings->rate($project, $request->user(), $request->validated()), 201);
    }
}
