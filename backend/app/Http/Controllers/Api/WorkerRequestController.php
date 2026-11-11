<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RespondToRequestRequest;
use App\Models\ProjectWorkerRequest;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkerRequestController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    /** The project details behind an invite/application, for the worker it belongs to — before they decide. */
    public function project(Request $request, ProjectWorkerRequest $workerRequest): JsonResponse
    {
        return response()->json($this->projects->projectDetailsForWorkerRequest($workerRequest, $request->user()));
    }

    public function respond(RespondToRequestRequest $request, ProjectWorkerRequest $workerRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->projects->respondToWorkerRequest(
            $workerRequest,
            $request->user(),
            $request->validated('decision') === 'accept'
        ));
    }
}
