<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WorkerHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkerHistoryController extends Controller
{
    public function __construct(private readonly WorkerHistoryService $history) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->history->listFor($request->user()));
    }

    public function show(Request $request, int $projectId): JsonResponse
    {
        return response()->json($this->history->detailsFor($request->user(), $projectId));
    }
}
