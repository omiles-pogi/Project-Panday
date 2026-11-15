<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\HomeownerTeamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomeownerTeamController extends Controller
{
    public function __construct(private readonly HomeownerTeamService $teams) {}

    public function show(Request $request, int $projectId): JsonResponse
    {
        return response()->json($this->teams->overview($request->user(), $projectId));
    }
}
