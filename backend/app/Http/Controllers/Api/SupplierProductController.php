<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupplierProductRequest;
use App\Http\Requests\UpdateSupplierProductRequest;
use App\Models\SupplierProduct;
use App\Services\SupplierProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        return $this->attempt(fn () => $this->products->update($supplierProduct, $request->user(), $request->validated()));
    }

    public function destroy(Request $request, SupplierProduct $supplierProduct): JsonResponse
    {
        return $this->attempt(function () use ($request, $supplierProduct) {
            $this->products->delete($supplierProduct, $request->user());

            return null;
        }, 204);
    }
}
