<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateHomeownerProfileRequest;
use App\Services\HomeownerProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomeownerProfileController extends Controller
{
    public function __construct(private readonly HomeownerProfileService $profiles) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->profiles->show($request->user()));
    }

    public function update(UpdateHomeownerProfileRequest $request): JsonResponse
    {
        return response()->json($this->profiles->update($request->user(), $request->validated()));
    }
}
