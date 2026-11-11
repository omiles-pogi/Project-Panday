<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\ProjectDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectDashboardController extends Controller
{
    public function __construct(private readonly ProjectDashboardService $dashboard) {}

    public function overview(Request $request): JsonResponse
    {
        return response()->json($this->dashboard->overview($request->user()));
    }

    public function hide(Request $request, Project $project): JsonResponse
    {
        return response()->json($this->dashboard->hide($project, $request->user()));
    }
}
