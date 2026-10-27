<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ConstructionPlanGenerationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\GeneratePlanRequest;
use App\Services\ConstructionPlanService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConstructionPlanController extends Controller
{
    public function __construct(private readonly ConstructionPlanService $planService) {}

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

        return response()->stream(function () use ($messages, $forcePlan) {
            $emit = function (array $event) {
                echo json_encode($event)."\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };

            try {
                $result = $this->planService->generate(
                    $messages,
                    $forcePlan,
                    fn (string $text) => $emit(['type' => 'chunk', 'text' => $text])
                );
                $emit(['type' => 'done', 'result' => $result]);
            } catch (ConstructionPlanGenerationException $e) {
                $emit(['type' => 'error', 'message' => $e->getMessage(), 'status' => $e->statusCode()]);
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
