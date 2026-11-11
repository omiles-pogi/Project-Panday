<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RespondToRequestRequest;
use App\Models\ProjectContractorRequest;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractorRequestController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    /** The project details behind an invite/application, for the contractor it belongs to — before they decide. */
    public function project(Request $request, ProjectContractorRequest $contractorRequest): JsonResponse
    {
        return response()->json($this->projects->projectDetailsForContractorRequest($contractorRequest, $request->user()));
    }

    public function respond(RespondToRequestRequest $request, ProjectContractorRequest $contractorRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->respondToContractorRequest(
            $contractorRequest,
            $request->user(),
            $request->validated('decision') === 'accept'
        ));
    }
}
