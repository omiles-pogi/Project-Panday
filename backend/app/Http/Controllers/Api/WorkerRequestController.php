<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RespondToRequestRequest;
use App\Models\ProjectWorkerRequest;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class WorkerRequestController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function respond(RespondToRequestRequest $request, ProjectWorkerRequest $workerRequest): JsonResponse
    {
        try {
            $workerRequest = $this->projects->respondToWorkerRequest(
                $workerRequest,
                $request->user(),
                $request->validated('decision') === 'accept'
            );
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($workerRequest);
    }
}
