<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RateContractorRequest;
use App\Http\Requests\SearchContractorsRequest;
use App\Http\Requests\UpdateContractorProfileRequest;
use App\Models\User;
use App\Services\ContractorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class ContractorController extends Controller
{
    public function __construct(private readonly ContractorService $contractors) {}

    public function updateProfile(UpdateContractorProfileRequest $request): JsonResponse
    {
        $profile = $this->contractors->updateProfile($request->user(), $request->validated());

        return response()->json($profile);
    }

    public function search(SearchContractorsRequest $request): JsonResponse
    {
        $results = $this->contractors->search(
            $request->validated('specialization'),
            $request->validated('skills') ?? []
        );

        return response()->json($results);
    }

    public function show(User $contractor): JsonResponse
    {
        if ($contractor->role !== 'contractor') {
            return response()->json(['error' => 'Not a contractor account.'], 404);
        }

        return response()->json($this->contractors->profile($contractor));
    }

    public function rate(RateContractorRequest $request, User $contractor): JsonResponse
    {
        try {
            $rating = $this->contractors->rate($contractor, $request->user(), $request->validated());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($rating, 201);
    }
}
