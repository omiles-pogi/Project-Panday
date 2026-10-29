<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdvanceSupplierOrderRequest;
use App\Http\Requests\ConfirmSupplierOrderRequest;
use App\Http\Requests\MaterialDecisionRequest;
use App\Models\SupplierOrder;
use App\Services\SupplierOrderService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Supplier side of the material workflow — every action is limited to the supplier's own orders. */
class SupplierOrderController extends Controller
{
    public function __construct(private readonly SupplierOrderService $orders) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->orders->listFor($request->user()));
    }

    public function show(Request $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->orders->show($supplierOrder, $request->user()));
    }

    public function confirm(ConfirmSupplierOrderRequest $request, SupplierOrder $supplierOrder): JsonResponse
    {
        $prices = collect($request->validated('items') ?? [])->mapWithKeys(fn (array $i) => [(int) $i['id'] => (int) $i['unit_price']])->all();

        return $this->attempt(fn () => $this->orders->confirm(
            $supplierOrder,
            $request->user(),
            $prices,
            $request->validated('expected_delivery_date'),
            $request->validated('note'),
        ));
    }

    public function insufficient(MaterialDecisionRequest $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->orders->reportUnavailable($supplierOrder, $request->user(), false, $request->validated('reason')));
    }

    public function decline(MaterialDecisionRequest $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->orders->reportUnavailable($supplierOrder, $request->user(), true, $request->validated('reason')));
    }

    public function advance(AdvanceSupplierOrderRequest $request, SupplierOrder $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->orders->advance($supplierOrder, $request->user(), $request->validated('status')));
    }

    private function attempt(Closure $action): JsonResponse
    {
        try {
            return response()->json($action());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
