<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RespondToRequestRequest;
use App\Models\ProjectContractorRequest;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class ContractorRequestController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function respond(RespondToRequestRequest $request, ProjectContractorRequest $contractorRequest): JsonResponse
    {
        try {
            $contractorRequest = $this->projects->respondToContractorRequest(
                $contractorRequest,
                $request->user(),
                $request->validated('decision') === 'accept'
            );
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($contractorRequest);
    }
}
