<?php

namespace Tests\Feature;

use App\Services\ConstructionPlanService;
use Tests\TestCase;

class PlanBudgetTest extends TestCase
{
    /**
     * @return array<string, mixed>
     */
    private function aiPlan(float $budget, float $totalEstimate): array
    {
        return [
            'budget' => $budget,
            'totalEstimate' => $totalEstimate,
            'budgetBreakdown' => [
                ['category' => 'Construction Materials', 'amount' => 1_900_000],
                ['category' => 'Labor Costs', 'amount' => 1_100_000],
            ],
        ];
    }

    private function finalize(array $plan, string ...$userMessages): array
    {
        $messages = array_map(fn ($m) => ['role' => 'user', 'content' => $m], $userMessages);

        return app(ConstructionPlanService::class)->finalizeBudget($plan, $messages);
    }

    public function test_the_homeowners_stated_budget_overrides_whatever_the_ai_put(): void
    {
        // AI "adjusted" the budget up to its own estimate — the homeowner said 2.5M.
        $plan = $this->finalize($this->aiPlan(3_000_000, 3_000_000), '3BR house, 120 sqm, ₱2.5M budget');

        $this->assertSame(2_500_000, $plan['budget']);
    }

    public function test_the_estimate_is_the_breakdown_sum_and_independent_of_the_budget(): void
    {
        // AI claimed an estimate equal to the budget, but its own breakdown sums to 3.0M.
        $plan = $this->finalize($this->aiPlan(2_500_000, 2_500_000), 'budget 2.5M');

        $this->assertSame(2_500_000, $plan['budget']);
        $this->assertSame(3_000_000, $plan['totalEstimate']);
    }

    public function test_a_budget_the_homeowner_never_gave_is_not_set(): void
    {
        $plan = $this->finalize($this->aiPlan(2_800_000, 3_000_000), '3 bedroom modern house in Cebu, 150 sqm');

        $this->assertSame(0, $plan['budget']);
    }

    public function test_the_ai_budget_is_kept_when_the_homeowner_typed_that_amount(): void
    {
        $plan = $this->finalize($this->aiPlan(2_000_000, 3_000_000), 'A ₱2M house in Davao');

        $this->assertSame(2_000_000, $plan['budget']);
    }

    public function test_a_later_budget_change_wins(): void
    {
        $plan = $this->finalize($this->aiPlan(2_000_000, 3_000_000), 'budget 2M', 'ok raise my budget to 3.2 million');

        $this->assertSame(3_200_000, $plan['budget']);
    }
}
