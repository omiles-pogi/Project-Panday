<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSupplierProfileRequest;
use App\Services\SupplierProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierProfileController extends Controller
{
    public function __construct(private readonly SupplierProfileService $profiles) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->profiles->show($request->user()));
    }

    public function update(UpdateSupplierProfileRequest $request): JsonResponse
    {
        return response()->json($this->profiles->update($request->user(), $request->validated()));
    }
}
