<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AwardQuoteRequestRequest;
use App\Http\Requests\StoreQuoteRequestRequest;
use App\Http\Requests\SubmitQuoteBidRequest;
use App\Models\Project;
use App\Models\QuoteRequest;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class QuoteController extends Controller
{
    public function __construct(private readonly QuoteService $quotes) {}

    // ---- homeowner / contractor ----------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->quotes->listForRequester($request->user()));
    }

    public function store(StoreQuoteRequestRequest $request, Project $project): JsonResponse
    {
        try {
            return response()->json($this->quotes->create($project, $request->user(), $request->validated()), 201);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function award(AwardQuoteRequestRequest $request, QuoteRequest $quoteRequest): JsonResponse
    {
        try {
            return response()->json($this->quotes->award($quoteRequest, $request->user(), (int) $request->validated()['bid_id']));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function cancel(Request $request, QuoteRequest $quoteRequest): JsonResponse
    {
        try {
            return response()->json($this->quotes->cancel($quoteRequest, $request->user()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    // ---- supplier ------------------------------------------------------------------------------

    public function supplierIndex(Request $request): JsonResponse
    {
        return response()->json($this->quotes->listForSupplier($request->user()));
    }

    public function bid(SubmitQuoteBidRequest $request, QuoteRequest $quoteRequest): JsonResponse
    {
        try {
            return response()->json($this->quotes->bid($quoteRequest, $request->user(), $request->validated()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function withdraw(Request $request, QuoteRequest $quoteRequest): JsonResponse
    {
        try {
            return response()->json($this->quotes->withdraw($quoteRequest, $request->user()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
