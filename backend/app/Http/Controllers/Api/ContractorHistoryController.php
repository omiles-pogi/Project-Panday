<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ContractorHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractorHistoryController extends Controller
{
    public function __construct(private readonly ContractorHistoryService $history) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->history->listFor($request->user()));
    }

    public function show(Request $request, int $projectId): JsonResponse
    {
        return response()->json($this->history->detailsFor($request->user(), $projectId));
    }
}
