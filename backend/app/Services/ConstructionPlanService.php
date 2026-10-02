<?php

namespace App\Services;

use App\Exceptions\ConstructionPlanGenerationException;
use Illuminate\Support\Facades\Http;

class ConstructionPlanService
{
    private const SYSTEM_PROMPT = <<<'PROMPT'
        You are a construction estimation engine for a Philippine home-building app. Given a homeowner's freeform project brief, produce a realistic, internally-consistent construction plan by calling the submit_construction_plan tool.

        Rules:
        - All money amounts are Philippine pesos (PHP), as plain numbers (no currency symbols or commas).
        - Use realistic present-day Philippine construction market rates, cities, and suppliers.
        - budgetBreakdown amounts must sum to approximately totalEstimate.
        - materials[].qty * materials[].unitPrice and equipment[].cost line items must be consistent with the totals in budgetBreakdown.
        - If the brief gives a budget, use it for the "budget" field; otherwise infer a reasonable one from scope.
        - Keep lists concise: 5-8 phases, 6-10 budgetBreakdown categories, 8-14 materials, 6-10 equipment items.
        PROMPT;

    /**
     * @return array<string, mixed>
     *
     * @throws ConstructionPlanGenerationException
     */
    public function generate(string $brief): array
    {
        $apiKey = config('services.anthropic.key');
        if (! $apiKey) {
            throw new ConstructionPlanGenerationException(
                'ANTHROPIC_API_KEY is not set. Add it to your .env file and restart the server.',
                500
            );
        }

        $response = Http::withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
        ])->post('https://api.anthropic.com/v1/messages', [
            'model' => config('services.anthropic.model'),
            'max_tokens' => 4096,
            'system' => self::SYSTEM_PROMPT,
            'messages' => [
                ['role' => 'user', 'content' => $brief],
            ],
            'tools' => [$this->planTool()],
            'tool_choice' => ['type' => 'tool', 'name' => 'submit_construction_plan'],
        ]);

        if ($response->failed()) {
            throw new ConstructionPlanGenerationException(
                $response->json('error.message') ?? 'Anthropic API request failed.',
                $response->status()
            );
        }

        $toolUse = collect($response->json('content', []))
            ->firstWhere('type', 'tool_use');

        if (! $toolUse) {
            throw new ConstructionPlanGenerationException('AI did not return a structured plan.', 502);
        }

        return $toolUse['input'];
    }

    /**
     * @return array<string, mixed>
     */
    private function planTool(): array
    {
        return [
            'name' => 'submit_construction_plan',
            'description' => "Submit a complete structured construction plan for the homeowner's project.",
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'projectTitle' => ['type' => 'string'],
                    'location' => ['type' => 'string'],
                    'areaSqm' => ['type' => 'number'],
                    'floors' => ['type' => 'integer'],
                    'bedrooms' => ['type' => 'integer'],
                    'bathrooms' => ['type' => 'integer'],
                    'designStyle' => ['type' => 'string'],
                    'budget' => ['type' => 'number', 'description' => "Homeowner's allowable budget in PHP"],
                    'timelineMonths' => ['type' => 'integer'],
                    'phases' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'name' => ['type' => 'string'],
                                'percentComplete' => ['type' => 'number', 'description' => 'Share of total project effort/cost this phase represents, 0-100'],
                            ],
                            'required' => ['name', 'percentComplete'],
                        ],
                    ],
                    'budgetBreakdown' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'category' => ['type' => 'string'],
                                'amount' => ['type' => 'number'],
                            ],
                            'required' => ['category', 'amount'],
                        ],
                    ],
                    'materials' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'material' => ['type' => 'string'],
                                'category' => ['type' => 'string'],
                                'qty' => ['type' => 'number'],
                                'unit' => ['type' => 'string'],
                                'unitPrice' => ['type' => 'number'],
                            ],
                            'required' => ['material', 'category', 'qty', 'unit', 'unitPrice'],
                        ],
                    ],
                    'equipment' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'name' => ['type' => 'string'],
                                'qty' => ['type' => 'number'],
                                'duration' => ['type' => 'string'],
                                'cost' => ['type' => 'number'],
                                'phase' => ['type' => 'string'],
                            ],
                            'required' => ['name', 'qty', 'duration', 'cost', 'phase'],
                        ],
                    ],
                    'exteriorConcept' => ['type' => 'string', 'description' => '1-2 sentence exterior design concept'],
                    'interiorConcept' => ['type' => 'string', 'description' => '1-2 sentence interior design concept'],
                    'totalEstimate' => ['type' => 'number'],
                ],
                'required' => [
                    'projectTitle', 'location', 'areaSqm', 'floors', 'bedrooms', 'bathrooms', 'designStyle',
                    'budget', 'timelineMonths', 'phases', 'budgetBreakdown', 'materials', 'equipment',
                    'exteriorConcept', 'interiorConcept', 'totalEstimate',
                ],
            ],
        ];
    }
}
