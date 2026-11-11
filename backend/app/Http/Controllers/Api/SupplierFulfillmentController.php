<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmSupplierFulfillmentRequest;
use App\Http\Requests\MaterialDecisionRequest;
use App\Models\SupplierFulfillment;
use App\Services\SupplierFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Supplier side of the material workflow — every action is limited to the supplier's own fulfillments. */
class SupplierFulfillmentController extends Controller
{
    public function __construct(private readonly SupplierFulfillmentService $fulfillments) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->fulfillments->listFor($request->user()));
    }

    public function show(Request $request, SupplierFulfillment $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->fulfillments->show($supplierOrder, $request->user()));
    }

    public function confirm(ConfirmSupplierFulfillmentRequest $request, SupplierFulfillment $supplierOrder): JsonResponse
    {
        $prices = collect($request->validated('items') ?? [])->mapWithKeys(fn (array $i) => [(int) $i['id'] => (int) $i['unit_price']])->all();

        return $this->attempt(fn () => $this->fulfillments->confirm(
            $supplierOrder,
            $request->user(),
            $prices,
            $request->validated('expected_delivery_date'),
            $request->validated('note'),
        ));
    }

    public function insufficient(MaterialDecisionRequest $request, SupplierFulfillment $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->fulfillments->reportUnavailable($supplierOrder, $request->user(), false, $request->validated('reason')));
    }

    public function decline(MaterialDecisionRequest $request, SupplierFulfillment $supplierOrder): JsonResponse
    {
        return $this->attempt(fn () => $this->fulfillments->reportUnavailable($supplierOrder, $request->user(), true, $request->validated('reason')));
    }
}
