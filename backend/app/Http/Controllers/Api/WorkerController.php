<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RateWorkerRequest;
use App\Http\Requests\SearchWorkersRequest;
use App\Http\Requests\UpdateWorkerProfileRequest;
use App\Models\User;
use App\Services\WorkerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkerController extends Controller
{
    public function __construct(private readonly WorkerService $workers) {}

    public function updateProfile(UpdateWorkerProfileRequest $request): JsonResponse
    {
        $profile = $this->workers->updateProfile($request->user(), $request->validated());

        return response()->json($profile);
    }

    public function search(SearchWorkersRequest $request): JsonResponse
    {
        $results = $this->workers->search(
            $request->validated('trade'),
            $request->validated('skills') ?? [],
            $request->user()
        );

        return response()->json($results);
    }

    public function show(Request $request, User $worker): JsonResponse
    {
        if ($worker->role !== 'worker') {
            return response()->json(['error' => 'Not a worker account.'], 404);
        }

        return response()->json($this->workers->profile($worker, $request->user()));
    }

    public function rate(RateWorkerRequest $request, User $worker): JsonResponse
    {
        return $this->attempt(fn () => $this->workers->rate($worker, $request->user(), $request->validated()), 201);
    }
}
