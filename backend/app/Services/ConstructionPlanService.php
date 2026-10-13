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
        - Only set "location" to a specific city/region if the brief explicitly names one. Never invent or guess a location — if the brief doesn't state one, set "location" to an empty string.
        - Keep lists concise: 5-8 phases, 6-10 budgetBreakdown categories, 8-14 materials, 6-10 equipment items.
        - For each phase, include a tasks checklist of 3-6 short, concrete, checkable work items specific to that phase (e.g. for a "Foundation" phase: "Site clearing", "Land filling", "Excavation", "Rebar installation", "Concrete pouring"). These become a to-do checklist the contractor checks off as work is completed.
        PROMPT;

    private const CLARIFICATION_PROMPT_ADDENDUM = <<<'PROMPT'

        Before planning, decide if you have enough information:
        - If the brief describes renovating, remodeling, or adding onto an EXISTING structure (not a new build) and does not state the size of the room/space involved, call request_clarification with 1-3 short, specific questions instead of guessing (e.g. "What is the approximate size of the room in square meters?").
        - Otherwise, generate the plan directly. Do not ask about minor details, finishes, or preferences you can reasonably infer — only ask when a core quantity (like area) is missing for a renovation scope.
        PROMPT;

    private const MAX_ATTEMPTS = 3;

    /**
     * @return array<string, mixed> Either a full plan, or ['needsClarification' => true, 'questions' => string[]].
     *
     * @throws ConstructionPlanGenerationException
     */
    public function generate(string $brief, bool $allowClarification = true): array
    {
        $apiKey = config('services.groq.key');
        if (! $apiKey) {
            throw new ConstructionPlanGenerationException(
                'GROQ_API_KEY is not set. Add it to your .env file and restart the server.',
                500
            );
        }

        // Bounded to one clarification round: the second call (allowClarification=false) forces
        // the plan tool, so this always terminates within two AI calls — never an open loop.
        $tools = $allowClarification ? [$this->planTool(), $this->clarificationTool()] : [$this->planTool()];
        $toolChoice = $allowClarification
            ? 'auto'
            : ['type' => 'function', 'function' => ['name' => 'submit_construction_plan']];
        // Only mention request_clarification in the prompt when it's actually an offered tool —
        // otherwise the model tries to call it anyway and Groq rejects the whole response.
        $systemPrompt = self::SYSTEM_PROMPT.($allowClarification ? self::CLARIFICATION_PROMPT_ADDENDUM : '');

        for ($attempt = 1; $attempt <= self::MAX_ATTEMPTS; $attempt++) {
            $response = Http::withToken($apiKey)->post('https://api.groq.com/openai/v1/chat/completions', [
                'model' => config('services.groq.model'),
                'max_completion_tokens' => 4096,
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $brief],
                ],
                'tools' => $tools,
                'tool_choice' => $toolChoice,
            ]);

            // Groq itself sometimes reports these as API-level errors (not a 200 with bad
            // content) when strict structured-output generation fails internally — transient
            // glitches worth retrying, unlike auth/rate-limit/other failures.
            $retryableGroqErrors = [
                'Failed to parse tool call arguments',
                'did not call a tool',
                'did not match schema',
            ];
            $errorMessage = (string) $response->json('error.message');
            $isRetryableGroqError = $response->failed() && collect($retryableGroqErrors)
                ->contains(fn (string $needle) => str_contains($errorMessage, $needle));

            if ($response->failed() && ! $isRetryableGroqError) {
                throw new ConstructionPlanGenerationException(
                    $response->json('error.message') ?? 'Groq API request failed.',
                    $response->status()
                );
            }

            $toolCallName = $response->json('choices.0.message.tool_calls.0.function.name');
            $arguments = $isRetryableGroqError
                ? null
                : json_decode($response->json('choices.0.message.tool_calls.0.function.arguments', ''), true);

            if (is_array($arguments) && $toolCallName === 'request_clarification') {
                return ['needsClarification' => true, 'questions' => $arguments['questions'] ?? []];
            }

            if (is_array($arguments) && $toolCallName === 'submit_construction_plan') {
                return $arguments;
            }

            if ($attempt === self::MAX_ATTEMPTS) {
                throw new ConstructionPlanGenerationException('AI returned a malformed plan. Please try again.', 502);
            }
        }

        throw new ConstructionPlanGenerationException('AI returned a malformed plan. Please try again.', 502);
    }

    /**
     * @return array<string, mixed>
     */
    private function clarificationTool(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => 'request_clarification',
                'description' => 'Ask the homeowner 1-3 short questions before an accurate plan can be made. Use sparingly — only when a core detail like room size is missing for a renovation.',
                'strict' => true,
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'questions' => [
                            'type' => 'array',
                            'description' => '1 to 3 short, specific questions for the homeowner.',
                            'items' => ['type' => 'string'],
                        ],
                    ],
                    'required' => ['questions'],
                    'additionalProperties' => false,
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function planTool(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => 'submit_construction_plan',
                'description' => "Submit a complete structured construction plan for the homeowner's project.",
                'strict' => true,
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'projectTitle' => ['type' => 'string'],
                        'location' => ['type' => 'string', 'description' => "The brief's stated location, verbatim. Empty string if the brief does not name one — never invent a city or region."],
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
                                    'tasks' => [
                                        'type' => 'array',
                                        'description' => 'Checklist of 3-6 concrete, checkable work items for this phase.',
                                        'items' => ['type' => 'string'],
                                    ],
                                ],
                                'required' => ['name', 'percentComplete', 'tasks'],
                                'additionalProperties' => false,
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
                                'additionalProperties' => false,
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
                                'additionalProperties' => false,
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
                                'additionalProperties' => false,
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
                    'additionalProperties' => false,
                ],
            ],
        ];
    }
}
