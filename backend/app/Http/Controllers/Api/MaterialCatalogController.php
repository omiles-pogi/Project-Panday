<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchMaterialsRequest;
use App\Models\SupplierProduct;
use App\Services\SupplierProductService;
use Illuminate\Http\JsonResponse;

/** Read-only material catalog for homeowners/contractors — editing stays in SupplierProductController. */
class MaterialCatalogController extends Controller
{
    public function __construct(private readonly SupplierProductService $products) {}

    public function index(SearchMaterialsRequest $request): JsonResponse
    {
        return response()->json($this->products->catalog($request->validated()));
    }

    public function show(SupplierProduct $supplierProduct): JsonResponse
    {
        return response()->json($this->products->catalogItem($supplierProduct));
    }
}
