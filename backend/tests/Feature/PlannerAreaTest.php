<?php

namespace Tests\Feature;

use App\Services\ConstructionPlanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PlannerAreaTest extends TestCase
{
    use RefreshDatabase;

    private function toolCallStream(array $plan): string
    {
        $delta = ['tool_calls' => [['function' => ['name' => 'submit_construction_plan', 'arguments' => json_encode($plan)]]]];

        return 'data: '.json_encode(['choices' => [['delta' => $delta]]])."\n\ndata: [DONE]\n\n";
    }

    /** @return array<string, mixed> */
    private function aiPlan(float $areaSqm, int $garageCars): array
    {
        $categories = ['Foundation and Excavation', 'Construction Materials', 'Labor Costs', 'Contractor and Project Management Fee', 'Electrical and Plumbing', 'Finishing Works'];

        return [
            'projectTitle' => 'House', 'location' => '', 'areaSqm' => $areaSqm, 'floors' => 1, 'bedrooms' => 3, 'bathrooms' => 2, 'garageCars' => $garageCars,
            'designStyle' => 'Modern', 'budget' => 0, 'timelineMonths' => 8,
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'durationWeeks' => 34, 'tasks' => ['Pour slab']]],
            'budgetBreakdown' => array_map(fn (string $c) => ['category' => $c, 'amount' => 100000], $categories),
            'materials' => [],
            'exteriorConcept' => 'x', 'interiorConcept' => 'y', 'totalEstimate' => 600000,
        ];
    }

    public function test_the_planner_is_told_the_area_is_the_one_the_homeowner_gave_and_a_garage_is_not_added_to_it(): void
    {
        config(['services.groq.key' => 'test-key']);
        Http::fake(['api.groq.com/*' => Http::response($this->toolCallStream($this->aiPlan(190, 1)), 200)]);

        $plan = app(ConstructionPlanService::class)->generate(
            [['role' => 'user', 'content' => 'a 190 sqm house, 3 bedrooms, 2 baths, with a 1-car garage']],
            true,
            fn () => null
        );

        Http::assertSent(function (Request $request) {
            $system = $request->data()['messages'][0]['content'];
            $garageField = json_encode($request->data()['tools']);

            return str_contains($system, 'areaSqm is the floor area exactly as the homeowner stated it')
                && str_contains($system, 'but not in areaSqm')
                && str_contains($garageField, 'never added to areaSqm')
                && ! str_contains($system, 'driveway and door in areaSqm');
        });

        // The server doesn't touch the figure the AI returns.
        $this->assertSame(190, (int) $plan['areaSqm']);
        $this->assertSame(1, $plan['garageCars']);
    }
}
