<?php

namespace Tests\Feature;

use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\SupplierOrder;
use App\Models\User;
use App\Services\ConstructionPlanService;
use App\Services\ProjectBudgetService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlannerAppDataTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function plan(): array
    {
        return [
            'projectTitle' => 'Saved House', 'location' => 'Cebu', 'budget' => 2000000,
            'totalEstimate' => 9999999, 'timelineMonths' => 6,
            'areaSqm' => 80, 'floors' => 1, 'bedrooms' => 2, 'bathrooms' => 1, 'garageCars' => 0,
            'designStyle' => 'Modern', 'exteriorConcept' => 'Simple facade', 'interiorConcept' => 'Open kitchen',
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100, 'tasks' => ['Pour slab']]],
            'budgetBreakdown' => [
                ['category' => 'Construction Materials', 'amount' => 300000],
                ['category' => 'Labor Costs', 'amount' => 200000],
            ],
            'materials' => [['material' => 'Estimated cement', 'category' => 'Construction Materials', 'qty' => 10, 'unit' => 'bag', 'unitPrice' => 200]],
        ];
    }

    public function test_the_approved_breakdown_scope_and_materials_survive_a_new_dashboard_request(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $id = $this->postJson('/api/projects', $this->plan())->assertCreated()->json('id');

        $this->getJson("/api/dashboard?project_id={$id}")->assertOk()
            ->assertJsonPath('project.totalEstimate', 500000)
            ->assertJsonPath('project.approvedPlan.totalEstimate', 500000)
            ->assertJsonPath('project.approvedPlan.budgetBreakdown', $this->plan()['budgetBreakdown'])
            ->assertJsonPath('project.approvedPlan.areaSqm', 80)
            ->assertJsonPath('project.approvedPlan.garageCars', 0)
            ->assertJsonPath('project.approvedPlan.materials.0.material', 'Estimated cement')
            ->assertJsonPath('project.budgetRecords.paidTotal', null);
    }

    public function test_approving_a_placeholder_also_persists_the_breakdown(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $id = $this->postJson('/api/projects/draft')->assertCreated()->json('id');
        $this->postJson("/api/projects/{$id}/plan", $this->plan())->assertOk();

        $this->assertSame($this->plan()['budgetBreakdown'], Project::findOrFail($id)->approved_plan['budgetBreakdown']);
    }

    public function test_an_unspecified_location_stays_empty_in_the_recoverable_plan(): void
    {
        Sanctum::actingAs($this->user());
        $id = $this->postJson('/api/projects', array_replace($this->plan(), ['location' => '']))->assertCreated()->json('id');

        $this->getJson("/api/dashboard?project_id={$id}")->assertOk()
            ->assertJsonPath('project.location', null)
            ->assertJsonPath('project.approvedPlan.location', '');
    }

    public function test_missing_legacy_breakdowns_and_payment_data_are_not_invented(): void
    {
        $owner = $this->user();
        $project = app(ProjectService::class)->createFromPlan($owner, $this->plan());
        $project->update(['approved_plan' => null]);
        $project->phases()->update(['progress_pct' => 100]);
        Sanctum::actingAs($owner);

        $this->getJson("/api/dashboard?project_id={$project->id}")->assertOk()
            ->assertJsonPath('project.approvedPlan', null)
            ->assertJsonPath('project.overallProgressPct', 100)
            ->assertJsonPath('project.budgetRecords.confirmedMaterialTotal', 0)
            ->assertJsonPath('project.budgetRecords.orderLines', [])
            ->assertJsonPath('project.budgetRecords.paidTotal', null);
    }

    public function test_only_supplier_confirmed_live_orders_count_as_material_commitments(): void
    {
        $owner = $this->user();
        $contractor = $this->user('contractor');
        $supplier = $this->user('supplier');
        $project = app(ProjectService::class)->createFromPlan($owner, $this->plan());
        $product = $supplier->supplierProducts()->create(['name' => 'Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 999, 'stock' => 100]);
        $request = MaterialRequest::create(['project_id' => $project->id, 'contractor_id' => $contractor->id, 'homeowner_id' => $owner->id, 'status' => MaterialRequest::APPROVED]);

        foreach ([SupplierOrder::CONFIRMED, SupplierOrder::RECEIVED, SupplierOrder::AWAITING_HOMEOWNER, SupplierOrder::CANCELLED, SupplierOrder::SUPPLIER_REVIEW] as $status) {
            $order = $request->orders()->create(['supplier_id' => $supplier->id, 'status' => $status]);
            $request->items()->create([
                'supplier_order_id' => $order->id, 'supplier_product_id' => $product->id, 'supplier_id' => $supplier->id,
                'material_name' => 'Cement snapshot', 'unit' => 'bag', 'quantity' => 10,
                'estimated_unit_price' => 200, 'confirmed_unit_price' => $status === SupplierOrder::SUPPLIER_REVIEW ? null : 250,
            ]);
        }

        $records = app(ProjectBudgetService::class)->recordsFor($project);
        $this->assertSame(5000, $records['confirmedMaterialTotal']);
        $this->assertCount(5, $records['orderLines']);
        $this->assertSame('Construction Materials', $records['orderLines'][0]['category']);
        $this->assertSame(250, $records['orderLines'][0]['unitPrice']);
        $this->assertNull($records['paidTotal']);

        $other = app(ProjectService::class)->createFromPlan($this->user(), $this->plan());
        $this->assertSame([], app(ProjectBudgetService::class)->recordsFor($other)['orderLines']);
    }

    public function test_supplier_links_are_verified_again_when_the_plan_is_approved(): void
    {
        $supplier = $this->user('supplier');
        $product = $supplier->supplierProducts()->create(['name' => 'Real cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 300, 'stock' => 100]);
        $plan = $this->plan();
        $plan['materials'][0] += ['supplierProductId' => $product->id, 'supplierName' => 'Invented supplier'];
        $project = app(ProjectService::class)->createFromPlan($this->user(), $plan);

        $material = $project->fresh()->approved_plan['materials'][0];
        $this->assertSame('Real cement', $material['material']);
        $this->assertSame(300, $material['unitPrice']);
        $this->assertSame($supplier->name, $material['supplierName']);

        $product->update(['stock' => 0]);
        $project = app(ProjectService::class)->createFromPlan($this->user(), $plan);
        $material = $project->fresh()->approved_plan['materials'][0];
        $this->assertSame(0, $material['supplierProductId']);
        $this->assertNull($material['supplierName']);
    }

    public function test_another_owners_project_cannot_be_used_as_planner_context(): void
    {
        $project = app(ProjectService::class)->createFromPlan($this->user(), $this->plan());
        Http::preventStrayRequests();
        Sanctum::actingAs($this->user());

        $this->postJson('/api/ai/plan', ['project_id' => $project->id, 'messages' => [['role' => 'user', 'content' => 'How is my project?']]])
            ->assertUnprocessable()->assertJsonValidationErrors('project_id');
        Http::assertNothingSent();
    }

    public function test_each_planner_turn_gets_fresh_selected_project_records(): void
    {
        config(['services.groq.key' => 'test-key', 'services.groq.tpm_limit' => 30000]);
        $owner = $this->user();
        $project = app(ProjectService::class)->createFromPlan($owner, $this->plan());
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id, ['wage_amount' => 800, 'wage_unit' => 'per_day', 'wage_days' => 10]);
        app(ProjectService::class)->createFromPlan($owner, array_replace($this->plan(), ['projectTitle' => 'Other project must not leak']));

        $snapshots = [];
        Http::fake(function (Request $request) use (&$snapshots) {
            $prompt = $request->data()['messages'][0]['content'];
            $snapshots[] = json_decode(substr($prompt, strrpos($prompt, "\n") + 1), true);

            $delta = ['content' => 'Based on your saved project records.'];

            return Http::response('data: '.json_encode(['choices' => [['delta' => $delta]]])."\n\ndata: [DONE]\n\n", 200);
        });
        Sanctum::actingAs($owner);
        $payload = ['project_id' => $project->id, 'messages' => [['role' => 'user', 'content' => 'What are my agreed team costs?']]];
        $this->postJson('/api/ai/plan', $payload)->assertOk()->streamedContent();
        $project->workers()->updateExistingPivot($worker->id, ['wage_amount' => 950]);
        $project->phases()->update(['progress_pct' => 50]);
        $this->postJson('/api/ai/plan', $payload)->assertOk()->streamedContent();

        $this->assertCount(2, $snapshots);
        $this->assertSame($project->id, $snapshots[0]['id']);
        $this->assertSame('Saved House', $snapshots[0]['title']);
        $this->assertSame(8000, $snapshots[0]['teamWageTotal']);
        $this->assertSame(9500, $snapshots[1]['teamWageTotal']);
        $this->assertSame(50, $snapshots[1]['overallProgressPct']);
        $this->assertSame('Pour slab', $snapshots[1]['phases'][0]['tasks'][0]['description']);
        $this->assertNull($snapshots[1]['budgetRecords']['paidTotal']);
        $this->assertSame(9500, $snapshots[1]['budgetRecords']['agreedWageTotal']);
        Http::assertSent(fn (Request $request) => ! str_contains($request->data()['messages'][0]['content'], 'Other project must not leak'));
    }

    public function test_owner_only_budget_records_are_not_exposed_to_assigned_workers(): void
    {
        $project = app(ProjectService::class)->createFromPlan($this->user(), $this->plan());
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);
        Sanctum::actingAs($worker);

        $this->getJson('/api/my-projects')->assertOk()
            ->assertJsonPath('0.approvedPlan', null)
            ->assertJsonPath('0.budgetRecords', null);
    }

    public function test_a_saved_budget_is_preserved_without_requiring_the_old_conversation(): void
    {
        $plan = app(ConstructionPlanService::class)->finalizeBudget(
            array_replace($this->plan(), ['budget' => 9999999]),
            [['role' => 'user', 'content' => 'Add a bathroom']],
            2000000,
        );
        $this->assertSame(2000000, $plan['budget']);
    }

    public function test_automatic_wage_estimates_are_separate_from_agreed_commitments(): void
    {
        $project = app(ProjectService::class)->createFromPlan($this->user(), $this->plan());
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id, ['wage_amount' => 800, 'wage_unit' => 'per_day', 'wage_days' => 10, 'wage_auto' => true]);

        $records = app(ProjectBudgetService::class)->recordsFor($project);
        $this->assertSame(0, $records['agreedWageTotal']);
        $this->assertSame(8000, $records['automaticWageTotal']);
    }

    public function test_even_force_plan_allows_questions_instead_of_forcing_guesses(): void
    {
        config(['services.groq.key' => 'test-key']);
        $delta = ['tool_calls' => [['function' => ['name' => 'request_clarification', 'arguments' => json_encode(['questions' => ['What is the floor area?']])]]]];
        Http::fake(['api.groq.com/*' => Http::response('data: '.json_encode(['choices' => [['delta' => $delta]]])."\n\ndata: [DONE]\n\n", 200)]);

        $result = app(ConstructionPlanService::class)->generate([['role' => 'user', 'content' => 'Build a house']], true, fn () => null);
        $this->assertTrue($result['needsClarification']);
        Http::assertSent(fn (Request $request) => $request->data()['tool_choice'] === 'auto');
    }

    public function test_a_typical_plan_and_fresh_records_fit_the_default_token_limit(): void
    {
        config(['services.groq.key' => 'test-key', 'services.groq.tpm_limit' => 8000]);
        $plan = $this->plan();
        $plan['phases'] = array_fill(0, 6, ['name' => 'Construction phase', 'percentComplete' => 16, 'durationWeeks' => 4,
            'tasks' => ['Prepare materials and clear work area', 'Install required components', 'Inspect the completed work', 'Complete finishing and clean up']]);
        $plan['materials'] = array_fill(0, 12, ['material' => 'Portland Cement 40kg', 'category' => 'Construction Materials', 'qty' => 100, 'unit' => 'bag', 'unitPrice' => 300, 'supplierProductId' => 0]);
        $owner = $this->user();
        $project = app(ProjectService::class)->createFromPlan($owner, $plan);
        $context = app(ProjectService::class)->planningContextFor($owner, $project->id);
        $delta = ['content' => 'Your saved project has not started construction.'];
        Http::fake(['api.groq.com/*' => Http::response('data: '.json_encode(['choices' => [['delta' => $delta]]])."\n\ndata: [DONE]\n\n", 200)]);

        app(ConstructionPlanService::class)->generate([['role' => 'user', 'content' => 'What is my project progress?']], false, fn () => null, $plan, [], $context);

        Http::assertSent(function (Request $request) {
            $data = $request->data();
            $promptTokens = (int) ceil(strlen(json_encode([$data['messages'], $data['tools']], JSON_UNESCAPED_UNICODE)) / 3.8);

            return $promptTokens + $data['max_completion_tokens'] + 400 <= 8000;
        });
    }
}
