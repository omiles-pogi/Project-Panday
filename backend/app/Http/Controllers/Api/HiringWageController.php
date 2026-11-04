<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\HiringWageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HiringWageController extends Controller
{
    public function __construct(private readonly HiringWageService $wages) {}

    public function show(Request $request, Project $project): JsonResponse
    {
        return response()->json($this->wages->forProject($project, $request->user()));
    }
}
