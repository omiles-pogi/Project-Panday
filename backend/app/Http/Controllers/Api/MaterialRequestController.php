<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MaterialDecisionRequest;
use App\Http\Requests\StoreMaterialRequestRequest;
use App\Http\Requests\UpdateMaterialRequestRequest;
use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\SupplierOrder;
use App\Services\MaterialRequestService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Contractor + homeowner side of the material workflow (see MaterialRequestService). */
class MaterialRequestController extends Controller
{
    public function __construct(private readonly MaterialRequestService $requests) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->requests->listFor($request->user()));
    }

    public function show(Request $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->show($materialRequest, $request->user()));
    }

    public function store(StoreMaterialRequestRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->validated('project_id'));

        return $this->attempt(fn () => $this->requests->create($request->user(), $project, $request->validated('notes')), 201);
    }

    public function update(UpdateMaterialRequestRequest $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->update($materialRequest, $request->user(), $request->validated()));
    }

    public function submit(Request $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->submit($materialRequest, $request->user()));
    }

    public function approve(Request $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->approve($materialRequest, $request->user()));
    }

    public function requestRevision(MaterialDecisionRequest $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->requestRevision($materialRequest, $request->user(), $request->validated('reason')));
    }

    public function reject(MaterialDecisionRequest $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->reject($materialRequest, $request->user(), $request->validated('reason')));
    }

    public function cancel(MaterialDecisionRequest $request, MaterialRequest $materialRequest): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->cancel($materialRequest, $request->user(), $request->validated('reason')));
    }

    public function confirmPrices(Request $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->confirmOrderPrices($supplierOrder, $request->user()));
    }

    public function declinePrices(MaterialDecisionRequest $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->declineOrderPrices($supplierOrder, $request->user(), $request->validated('reason')));
    }

    public function receive(Request $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->receive($supplierOrder, $request->user()));
    }

    public function aiSuggestions(Request $request, Project $project): JsonResponse
    {
        return $this->attempt(fn () => $this->requests->aiSuggestions($project, $request->user()));
    }

    private function attempt(Closure $action, int $status = 200): JsonResponse
    {
        try {
            return response()->json($action(), $status);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
