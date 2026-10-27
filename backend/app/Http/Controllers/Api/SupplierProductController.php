<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupplierProductRequest;
use App\Http\Requests\UpdateSupplierProductRequest;
use App\Models\SupplierProduct;
use App\Services\SupplierProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SupplierProductController extends Controller
{
    public function __construct(private readonly SupplierProductService $products) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->products->listForSupplier($request->user()));
    }

    public function store(StoreSupplierProductRequest $request): JsonResponse
    {
        $product = $this->products->create($request->user(), $request->validated());

        return response()->json($product, 201);
    }

    public function update(UpdateSupplierProductRequest $request, SupplierProduct $supplierProduct): JsonResponse
    {
        try {
            $product = $this->products->update($supplierProduct, $request->user(), $request->validated());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($product);
    }

    public function destroy(Request $request, SupplierProduct $supplierProduct): JsonResponse
    {
        try {
            $this->products->delete($supplierProduct, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
    }
}
