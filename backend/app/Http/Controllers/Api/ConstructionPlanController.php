<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ConstructionPlanGenerationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\GeneratePlanRequest;
use App\Services\ConstructionPlanService;
use Illuminate\Http\JsonResponse;

class ConstructionPlanController extends Controller
{
    public function __construct(private readonly ConstructionPlanService $planService) {}

    public function store(GeneratePlanRequest $request): JsonResponse
    {
        try {
            $plan = $this->planService->generate($request->validated('brief'));
        } catch (ConstructionPlanGenerationException $e) {
            return response()->json(['error' => $e->getMessage()], $e->statusCode());
        }

        return response()->json($plan);
    }
}
