<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ConstructionPlanGenerationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\GeneratePlanRequest;
use App\Services\ConstructionPlanService;
use App\Services\ProjectService;
use App\Services\SupplierProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ConstructionPlanController extends Controller
{
    public function __construct(
        private readonly ConstructionPlanService $planService,
        private readonly SupplierProductService $suppliers,
        private readonly ProjectService $projects,
    ) {}

    /** Who can supply each of the plan's supplier-sourced categories — feeds the homeowner's supplier picker. */
    public function supplierOptions(): JsonResponse
    {
        return response()->json($this->suppliers->supplierOptions());
    }

    /**
     * Streams newline-delimited JSON events as the AI responds: {"type":"chunk","text":"..."} for
     * each piece of a live chat reply, then exactly one {"type":"done","result":...} or
     * {"type":"error","message":...,"status":...} to close out the request. The HTTP status is
     * always 200 here — by the time we know success/failure, headers are already sent, so the
     * outcome travels in the stream body instead.
     */
    public function store(GeneratePlanRequest $request): StreamedResponse
    {
        $messages = $request->validated('messages');
        $forcePlan = $request->boolean('force_plan', false);
        // input(), not validated(): Laravel drops un-ruled keys inside an array that has nested rules,
        // which would strip the plan's own scalar fields (title, area, ...). The size caps in
        // GeneratePlanRequest still apply, and the plan is only ever fed to the model as data.
        $currentPlan = $request->input('current_plan');
        $currentPlan = is_array($currentPlan) ? $currentPlan : null;
        $supplierSelections = $request->validated('supplier_selections') ?? [];
        $projectId = $request->validated('project_id');
        $projectContext = $projectId ? $this->projects->planningContextFor($request->user(), (int) $projectId) : null;
        $currentPlan ??= $projectContext['approvedPlan'] ?? null;
        $clientId = $request->header('X-PandAI-Request-ID', '');
        $requestId = preg_match('/\Apanday-[a-z0-9-]{1,80}\z/i', $clientId) ? $clientId : 'panday-'.Str::uuid();

        return response()->stream(function () use ($messages, $forcePlan, $currentPlan, $supplierSelections, $projectContext, $requestId) {
            $emit = function (array $event) {
                echo json_encode($event)."\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };

            try {
                $emit(['type' => 'started', 'requestId' => $requestId]);
                $result = $this->planService->generate(
                    $messages,
                    $forcePlan,
                    fn (string $text) => $emit(['type' => 'chunk', 'text' => $text]),
                    $currentPlan,
                    $supplierSelections,
                    $projectContext
                );
                $emit(['type' => 'done', 'result' => $result]);
            } catch (ConstructionPlanGenerationException $e) {
                Log::warning('PandAI request failed.', ['request_id' => $requestId, 'category' => $e->failureKind(), 'status' => $e->statusCode()] + $e->diagnostics());
                $emit(['type' => 'error', 'message' => $e->getMessage(), 'status' => $e->statusCode(), 'code' => $e->failureKind(), 'requestId' => $requestId]);
            } catch (Throwable $e) {
                Log::error('PandAI request failed.', ['request_id' => $requestId, 'category' => 'backend_error', 'exception_type' => get_class($e)]);
                $emit(['type' => 'error', 'message' => 'Project Panday could not complete this request. Your saved planning data is unchanged. Please retry.', 'status' => 500, 'code' => 'backend_error', 'requestId' => $requestId]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
