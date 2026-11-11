<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\NameProjectRequest;
use App\Models\Project;
use App\Services\ProjectNamingService;
use Illuminate\Http\JsonResponse;

class ProjectNamingController extends Controller
{
    public function __construct(private readonly ProjectNamingService $naming) {}

    public function update(NameProjectRequest $request, Project $project): JsonResponse
    {
        return response()->json($this->naming->save($project, $request->user(), $request->validated('name')));
    }
}
