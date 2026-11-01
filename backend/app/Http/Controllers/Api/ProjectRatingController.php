<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RateProjectTeamMemberRequest;
use App\Models\Project;
use App\Services\ProjectRatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProjectRatingController extends Controller
{
    public function __construct(private readonly ProjectRatingService $ratings) {}

    public function show(Request $request, Project $project): JsonResponse
    {
        try {
            return response()->json($this->ratings->statusFor($project, $request->user()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function store(RateProjectTeamMemberRequest $request, Project $project): JsonResponse
    {
        try {
            return response()->json($this->ratings->rate($project, $request->user(), $request->validated()), 201);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
