<?php

namespace App\Services;

use App\Exceptions\ConstructionPlanGenerationException;
use App\Support\HomeownerBudget;
use Illuminate\Support\Facades\Http;

class ConstructionPlanService
{
    public function __construct(private readonly SupplierProductService $supplierProducts) {}

    /** The only six categories budgetBreakdown may use — fixed so the UI can show a consistent icon/description per category. */
    private const BUDGET_CATEGORIES = [
        'Foundation and Excavation',
        'Construction Materials',
        'Labor Costs',
        'Contractor and Project Management Fee',
        'Electrical and Plumbing',
        'Finishing Works',
    ];

    private const SYSTEM_PROMPT = <<<'PROMPT'
        You are PandAi, a construction estimation assistant for a Philippine home-building app, having an ongoing conversation with a homeowner about their project.

        Rules for any construction plan you submit:
        - All money amounts are Philippine pesos (PHP), as plain numbers (no currency symbols or commas).
        - Use realistic present-day Philippine construction market rates, cities, and suppliers.
        - budgetBreakdown must contain EXACTLY these six categories, each exactly once, in this order: "Foundation and Excavation", "Construction Materials", "Labor Costs", "Contractor and Project Management Fee", "Electrical and Plumbing", "Finishing Works". Base each category's amount on the project's floor area, floors, materials, and finishing level — never a fixed or generic split.
        - budgetBreakdown amounts must sum to totalEstimate. Every cost belongs to exactly one category — never count the same material or labor expense in more than one category.
        - materials[].qty * materials[].unitPrice line items must be consistent with the totals in budgetBreakdown.
        - Base every field strictly on what the conversation actually states. Do not invent, change, or contradict any detail the homeowner gave (exact bedroom/bathroom count, exact budget, named location, named design style, etc.) — only fill in what's left unspecified.
        - "budget" and "totalEstimate" are two DIFFERENT numbers and must never be confused:
          * "budget" is the HOMEOWNER'S OWN budget — the amount they said they can spend, converted exactly (e.g. "₱2.5M" or "2.5 million" = 2500000, "800k" = 800000). If they have not stated a budget, set budget to 0. Never estimate, round, raise or lower it, and never copy totalEstimate into it.
          * "totalEstimate" is YOUR independent estimate of what the described scope will realistically cost in the Philippines today (floor area × floors × a realistic cost per sqm for the finish level, plus site, MEP and fees). Work it out from the scope alone. Do NOT scale, cap or fit it to the homeowner's budget — if the real cost is above or well below their budget, report the real cost anyway; the app shows the difference to the homeowner.
        - When you talk about money in a plain chat reply, always say clearly which number is "your budget" and which is "my estimate".
        - Only set "location" to a specific city/region if the conversation explicitly names one. Never invent or guess a location — leave it as an empty string otherwise.
        - Keep other lists concise: 5-8 phases, 8-14 materials.
        - For each phase, include a tasks checklist of 3-6 short, concrete, checkable work items specific to that phase (e.g. for a "Foundation" phase: "Site clearing", "Land filling", "Excavation", "Rebar installation", "Concrete pouring"). These become a to-do checklist the contractor checks off as work is completed.
        - submit_construction_plan always carries the COMPLETE current plan, never a partial update — when revising a plan from earlier in the conversation, restate every field, changing only what the homeowner's latest message asks you to change.
        PROMPT;

    private const CONVERSATIONAL_ADDENDUM = <<<'PROMPT'

        For each message, choose ONE:
        - If the homeowner is asking a question, making conversation, or you need to discuss something before changing the plan, reply normally in plain text — do not call a tool.
        - If you need a core detail before creating or updating the plan (e.g. a renovation's room size) that you don't already have from earlier in the conversation, call request_clarification with 1-3 short, specific questions.
        - If the homeowner described a new project, or asked you to change or update an existing one, call submit_construction_plan.
        Do not ask about minor details, finishes, or preferences you can reasonably infer — only ask when a core quantity is genuinely missing.
        PROMPT;

    private const FORCE_PLAN_ADDENDUM = "\n\nSubmit the complete, updated construction plan now based on the conversation so far.";

    private const MAX_ATTEMPTS = 3;

    /**
     * @param  array<int, array{role: string, content: string}>  $messages  The full conversation so far.
     * @param  callable(string): void  $onChunk  Called live with each piece of plain-text content as it
     *                                            streams in — only for a chat reply, since a plan/clarification
     *                                            is structured JSON behind a tool call with nothing meaningful
     *                                            to show partially.
     * @return array<string, mixed> One of: a full plan, ['needsClarification' => true, 'questions' => string[]],
     *                               or ['chatReply' => true, 'message' => string] for a plain conversational reply.
     *
     * @throws ConstructionPlanGenerationException
     */
    public function generate(array $messages, bool $forcePlan, callable $onChunk): array
    {
        $apiKey = config('services.groq.key');
        if (! $apiKey) {
            throw new ConstructionPlanGenerationException(
                'GROQ_API_KEY is not set. Add it to your .env file and restart the server.',
                500
            );
        }

        // forcePlan is a safety valve, not the normal path: once the conversation has already gone
        // through a couple of clarification rounds, the frontend sets this to force a plan on this
        // turn instead of letting the AI ask yet another question — guarantees the chat can't loop
        // forever. Normal turns leave the AI free to chat, ask, or plan via tool_choice "auto".
        $tools = $forcePlan ? [$this->planTool()] : [$this->planTool(), $this->clarificationTool()];
        $toolChoice = $forcePlan
            ? ['type' => 'function', 'function' => ['name' => 'submit_construction_plan']]
            : 'auto';
        // Only mention request_clarification / plain-chat replies when they're actually available —
        // otherwise the model tries to use them anyway and Groq rejects the whole response.
        $systemPrompt = self::SYSTEM_PROMPT.($forcePlan ? self::FORCE_PLAN_ADDENDUM : self::CONVERSATIONAL_ADDENDUM);
        // Grounds materials[].unitPrice in real supplier-listed prices where one exists, instead of
        // an always-guessed market rate. Empty string (no-op) when no supplier has listed anything yet.
        $systemPrompt .= $this->supplierProducts->pricingContextForPrompt();

        $apiMessages = array_merge([['role' => 'system', 'content' => $systemPrompt]], $messages);

        // Each attempt opens a fresh stream. A malformed/incoherent TOOL-CALL attempt is silently
        // retried (nothing was shown to the homeowner for that path — see streamOnce). A CHAT REPLY
        // is never retried once text starts streaming: it's already on screen, and plain text can't
        // "fail to parse" the way tool-call JSON can.
        for ($attempt = 1; $attempt <= self::MAX_ATTEMPTS; $attempt++) {
            $result = $this->streamOnce($apiKey, $apiMessages, $tools, $toolChoice, $onChunk);
            if ($result !== null) {
                $isPlan = ! isset($result['chatReply']) && ! isset($result['needsClarification']);

                return $isPlan ? $this->finalizeBudget($result, $messages) : $result;
            }
            if ($attempt === self::MAX_ATTEMPTS) {
                throw new ConstructionPlanGenerationException('AI returned a malformed response. Please try again.', 502);
            }
        }

        throw new ConstructionPlanGenerationException('AI returned a malformed response. Please try again.', 502);
    }

    /**
     * One streamed attempt. Returns null for a retryable failure (caller tries again with a fresh
     * stream); throws directly for a non-retryable failure (rate limit, auth, etc.).
     *
     * @param  array<int, array<string, mixed>>  $apiMessages
     * @param  array<int, array<string, mixed>>  $tools
     * @param  string|array<string, mixed>  $toolChoice
     * @param  callable(string): void  $onChunk
     * @return array<string, mixed>|null
     */
    private function streamOnce(string $apiKey, array $apiMessages, array $tools, string|array $toolChoice, callable $onChunk): ?array
    {
        $response = Http::withToken($apiKey)->withOptions(['stream' => true])->timeout(30)->post(
            'https://api.groq.com/openai/v1/chat/completions',
            [
                'model' => config('services.groq.model'),
                'max_completion_tokens' => 4096,
                // Low and fixed: this is a structured estimation task, not creative writing — we want
                // the plan tightly grounded in the conversation, not a different interpretation every call.
                'temperature' => 0.3,
                'messages' => $apiMessages,
                'tools' => $tools,
                'tool_choice' => $toolChoice,
                'stream' => true,
            ]
        );

        if ($response->status() === 429) {
            throw new ConstructionPlanGenerationException(
                'The AI service is busy right now. Please wait a moment and try again.',
                429
            );
        }

        if ($response->failed()) {
            // A request-level rejection (e.g. bad API key) arrives as an ordinary JSON body, not SSE —
            // Groq never starts streaming if it's rejecting the request outright.
            $retryableGroqErrors = ['Failed to parse tool call arguments', 'did not call a tool', 'did not match schema'];
            $errorMessage = (string) $response->json('error.message');
            $isRetryable = collect($retryableGroqErrors)->contains(fn (string $needle) => str_contains($errorMessage, $needle));
            if ($isRetryable) {
                return null;
            }
            throw new ConstructionPlanGenerationException($errorMessage ?: 'Groq API request failed.', $response->status());
        }

        $body = $response->toPsrResponse()->getBody();

        $contentBuffer = '';
        $toolCallName = null;
        $toolArgsBuffer = '';
        $sawContent = false;
        $sawToolCall = false;
        $lineBuffer = '';
        $done = false;

        while (! $done && ! $body->eof()) {
            $chunk = $body->read(2048);
            if ($chunk === '') {
                continue;
            }
            $lineBuffer .= $chunk;

            while (($newlinePos = strpos($lineBuffer, "\n")) !== false) {
                $line = trim(substr($lineBuffer, 0, $newlinePos));
                $lineBuffer = substr($lineBuffer, $newlinePos + 1);

                if ($line === '' || ! str_starts_with($line, 'data:')) {
                    continue;
                }
                $data = trim(substr($line, 5));
                if ($data === '[DONE]') {
                    $done = true;
                    break;
                }

                $event = json_decode($data, true);
                $delta = $event['choices'][0]['delta'] ?? null;
                if (! is_array($delta)) {
                    continue;
                }

                if (isset($delta['content']) && $delta['content'] !== '') {
                    $sawContent = true;
                    $contentBuffer .= $delta['content'];
                    $onChunk($delta['content']);
                }

                foreach ($delta['tool_calls'] ?? [] as $toolCallDelta) {
                    $sawToolCall = true;
                    if (isset($toolCallDelta['function']['name'])) {
                        $toolCallName = $toolCallDelta['function']['name'];
                    }
                    if (isset($toolCallDelta['function']['arguments'])) {
                        $toolArgsBuffer .= $toolCallDelta['function']['arguments'];
                    }
                }
            }
        }

        if ($sawContent && ! $sawToolCall) {
            $content = trim($contentBuffer);

            return $content !== '' ? ['chatReply' => true, 'message' => $content] : null;
        }

        if ($sawToolCall) {
            $arguments = json_decode($toolArgsBuffer, true);
            if (! is_array($arguments)) {
                return null;
            }
            if ($toolCallName === 'request_clarification') {
                return ['needsClarification' => true, 'questions' => $arguments['questions'] ?? []];
            }
            if ($toolCallName === 'submit_construction_plan' && $this->isCoherentPlan($arguments)) {
                return $arguments;
            }
        }

        return null;
    }

    /**
     * Keeps the two money figures honest and separate, rather than trusting the model with either:
     *
     * - budget: the homeowner's own words decide it (HomeownerBudget). The AI's value survives only
     *   if the homeowner actually typed that amount somewhere; otherwise it's 0 = "not set", so a
     *   guessed number is never shown as "Your Budget".
     * - totalEstimate: always exactly the sum of the category breakdown, so the headline estimate
     *   and the breakdown the homeowner reads can never disagree.
     *
     * @param  array<string, mixed>  $plan
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array<string, mixed>
     */
    public function finalizeBudget(array $plan, array $messages): array
    {
        $stated = HomeownerBudget::fromMessages($messages);
        $aiBudget = (float) ($plan['budget'] ?? 0);

        $plan['budget'] = $stated ?? (HomeownerBudget::wasMentioned($messages, $aiBudget) ? (int) round($aiBudget) : 0);
        $plan['totalEstimate'] = (int) round(array_sum(array_column($plan['budgetBreakdown'] ?? [], 'amount')));

        return $plan;
    }

    /**
     * Sanity-checks the numbers the AI generated rather than trusting the prompt's "must sum to
     * approximately totalEstimate" instruction blindly — LLM arithmetic drifts. A plan that fails
     * this is treated like a malformed response and retried.
     *
     * @param  array<string, mixed>  $plan
     */
    private function isCoherentPlan(array $plan): bool
    {
        $positiveFields = ['areaSqm', 'totalEstimate', 'timelineMonths'];
        foreach ($positiveFields as $field) {
            if (! isset($plan[$field]) || ! is_numeric($plan[$field]) || $plan[$field] <= 0) {
                return false;
            }
        }
        // 0 is valid: it means the homeowner hasn't stated a budget (see finalizeBudget).
        if (! isset($plan['budget']) || ! is_numeric($plan['budget']) || $plan['budget'] < 0) {
            return false;
        }
        if (! isset($plan['floors']) || ! is_numeric($plan['floors']) || $plan['floors'] < 1) {
            return false;
        }
        if (! isset($plan['bedrooms'], $plan['bathrooms']) || $plan['bedrooms'] < 0 || $plan['bathrooms'] < 0) {
            return false;
        }

        $budgetBreakdown = $plan['budgetBreakdown'] ?? [];
        if (empty($budgetBreakdown)) {
            return false;
        }
        // The UI shows a fixed icon/description per category, so the AI must return exactly these
        // six, each exactly once — not a subset, not duplicates, not a freeform list.
        $categories = array_column($budgetBreakdown, 'category');
        sort($categories);
        $expected = self::BUDGET_CATEGORIES;
        sort($expected);
        if ($categories !== $expected) {
            return false;
        }

        $breakdownSum = array_sum(array_column($budgetBreakdown, 'amount'));
        $totalEstimate = (float) $plan['totalEstimate'];
        // Slack absorbs rounding without letting the two numbers drift apart enough to look
        // obviously inconsistent to a homeowner reading both.
        $withinTolerance = abs($breakdownSum - $totalEstimate) <= $totalEstimate * 0.2;

        return $withinTolerance;
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
                        'budget' => ['type' => 'number', 'description' => "The homeowner's OWN stated budget in PHP, exactly as they said it (\"2.5M\" = 2500000). 0 if they never stated one. Never your estimate."],
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
                            'description' => 'Exactly these six categories, each exactly once: '.implode(', ', self::BUDGET_CATEGORIES).'.',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'category' => ['type' => 'string', 'enum' => self::BUDGET_CATEGORIES],
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
                        'exteriorConcept' => ['type' => 'string', 'description' => '1-2 sentence exterior design concept'],
                        'interiorConcept' => ['type' => 'string', 'description' => '1-2 sentence interior design concept'],
                        'totalEstimate' => ['type' => 'number', 'description' => 'YOUR independent realistic cost estimate for the scope in PHP — the sum of budgetBreakdown. Never fitted to the homeowner budget.'],
                    ],
                    'required' => [
                        'projectTitle', 'location', 'areaSqm', 'floors', 'bedrooms', 'bathrooms', 'designStyle',
                        'budget', 'timelineMonths', 'phases', 'budgetBreakdown', 'materials',
                        'exteriorConcept', 'interiorConcept', 'totalEstimate',
                    ],
                    'additionalProperties' => false,
                ],
            ],
        ];
    }
}
