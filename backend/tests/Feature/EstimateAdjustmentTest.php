<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EstimateAdjustmentTest extends TestCase
{
    use RefreshDatabase;

    private User $homeowner;

    private User $contractor;

    private User $supplier;

    private Project $project;

    private SupplierProduct $cement;

    private SupplierProduct $nails;

    protected function setUp(): void
    {
        parent::setUp();

        $this->homeowner = $this->user('homeowner');
        $this->contractor = $this->user('contractor');
        $this->supplier = $this->user('supplier', ['business_name' => 'Alpha Hardware']);
        $this->cement = $this->supplier->supplierProducts()->create(['name' => 'Portland Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 280, 'stock' => 500]);
        $this->nails = $this->supplier->supplierProducts()->create(['name' => 'Common Nails', 'category' => 'Hardware', 'unit' => 'kg', 'price' => 90, 'stock' => 500]);

        $this->project = $this->makeProject();
        $this->project->contractors()->attach($this->contractor->id);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    /** A ₱600,000 plan against a ₱700,000 budget: the plan lists 54 bags of cement and nothing else. */
    private function makeProject(bool $withMaterials = true, array $extraLines = []): Project
    {
        return app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Dela Cruz Residence', 'budget' => 700000, 'totalEstimate' => 600000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100, 'durationWeeks' => 26]],
            'budgetBreakdown' => array_merge([
                ['category' => 'Construction Materials', 'amount' => 200000],
                ['category' => 'Labor Costs', 'amount' => 320000],
                ['category' => 'Finishing Works', 'amount' => 80000],
            ], $extraLines),
            'materials' => $withMaterials ? [
                ['material' => 'Portland Cement', 'category' => 'Cement', 'qty' => 54, 'unit' => 'bag', 'unitPrice' => 280, 'supplierProductId' => $this->cement->id, 'phase' => 'Foundation'],
            ] : [],
        ]);
    }

    private function dashboard(?User $as = null): array
    {
        Sanctum::actingAs($as ?? $this->homeowner);

        return $this->getJson("/api/dashboard?project_id={$this->project->id}")->assertOk()->json('project');
    }

    /** Contractor drafts and submits a request for these lines; returns its id. */
    private function request(array $items, ?Project $project = null): int
    {
        Sanctum::actingAs($this->contractor);
        $id = $this->postJson('/api/material-requests', ['project_id' => ($project ?? $this->project)->id])->assertCreated()->json('id');
        $this->putJson("/api/material-requests/{$id}", ['items' => $items])->assertOk();
        $this->postJson("/api/material-requests/{$id}/submit")->assertOk();

        return $id;
    }

    /** Approves it if it's waiting — a request entirely inside the plan has already approved itself. */
    private function approve(int $id): void
    {
        Sanctum::actingAs($this->homeowner);
        if ($this->getJson("/api/material-requests/{$id}")->json('status') === 'pending_homeowner_approval') {
            $this->postJson("/api/material-requests/{$id}/approve")->assertOk();
        }

        $this->getJson("/api/material-requests/{$id}")->assertJsonPath('status', 'approved');
    }

    // ---- nothing changes while everything stays inside the plan --------------------------------

    public function test_the_estimate_starts_at_the_plans_and_nothing_is_added(): void
    {
        $project = $this->dashboard();

        $this->assertSame(600000, $project['totalEstimate']);
        $this->assertSame(600000, $project['planEstimate']);
        $this->assertSame(0, $project['estimateAdjustment']['additionsTotal']);
        $this->assertSame([], $project['estimateAdjustment']['additions']);
    }

    public function test_ordering_what_the_plan_listed_does_not_move_the_estimate(): void
    {
        $this->approve($this->request([['supplier_product_id' => $this->cement->id, 'quantity' => 54]]));

        $this->assertSame(600000, $this->dashboard()['totalEstimate']);
    }

    // ---- a sudden request for materials --------------------------------------------------------

    public function test_a_material_the_plan_never_listed_raises_the_estimate_and_lowers_what_is_left(): void
    {
        $before = $this->dashboard();
        $this->assertSame(100000, $before['budget'] - $before['totalEstimate']);

        $this->approve($this->request([['supplier_product_id' => $this->nails->id, 'quantity' => 10]]));

        $after = $this->dashboard();
        $this->assertSame(600900, $after['totalEstimate']);          // + 10 × ₱90
        $this->assertSame(600000, $after['planEstimate']);
        $this->assertSame(99100, $after['budget'] - $after['totalEstimate']);

        $addition = $after['estimateAdjustment']['additions'][0];
        $this->assertSame('materials', $addition['kind']);
        $this->assertSame(900, $addition['amount']);
        $this->assertSame('Common Nails', $addition['lines'][0]['material']);
        $this->assertSame('not in plan', $addition['lines'][0]['reason']);
    }

    public function test_only_the_quantity_above_the_plan_counts(): void
    {
        $this->approve($this->request([['supplier_product_id' => $this->cement->id, 'quantity' => 60]]));   // plan allows 54

        $project = $this->dashboard();
        $this->assertSame(600000 + 6 * 280, $project['totalEstimate']);
        $this->assertSame(6, $project['estimateAdjustment']['additions'][0]['lines'][0]['quantity']);
        $this->assertSame('above plan', $project['estimateAdjustment']['additions'][0]['lines'][0]['reason']);
    }

    public function test_the_plans_allowance_is_used_up_across_requests(): void
    {
        $this->approve($this->request([['supplier_product_id' => $this->cement->id, 'quantity' => 50]]));
        $this->assertSame(600000, $this->dashboard()['totalEstimate']);

        // 4 bags of the allowance are left; of 10 more, 6 are extra.
        $this->approve($this->request([['supplier_product_id' => $this->cement->id, 'quantity' => 10]]));
        $this->assertSame(600000 + 6 * 280, $this->dashboard()['totalEstimate']);
    }

    public function test_a_cancelled_request_takes_its_extra_cost_back_out(): void
    {
        $id = $this->request([['supplier_product_id' => $this->nails->id, 'quantity' => 10]]);
        $this->approve($id);
        $this->assertSame(600900, $this->dashboard()['totalEstimate']);

        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/material-requests/{$id}/cancel", ['reason' => 'Not needed'])->assertOk();

        $this->assertSame(600000, $this->dashboard()['totalEstimate']);
    }

    // ---- waiting for a decision ----------------------------------------------------------------

    public function test_a_request_waiting_for_approval_is_a_heads_up_not_yet_part_of_the_estimate(): void
    {
        $id = $this->request([['supplier_product_id' => $this->nails->id, 'quantity' => 10]]);

        $project = $this->dashboard();
        $this->assertSame(600000, $project['totalEstimate']);
        $this->assertSame(900, $project['estimateAdjustment']['pendingMaterialsTotal']);

        // The homeowner is told what approving would do before they decide.
        Sanctum::actingAs($this->homeowner);
        $impact = $this->getJson("/api/material-requests/{$id}")->assertOk()->json('estimateImpact');
        $this->assertSame(['amount' => 900, 'estimateBefore' => 600000, 'estimateAfter' => 600900, 'leftOverBefore' => 100000, 'leftOverAfter' => 99100], $impact);

        $this->approve($id);
        $after = $this->dashboard();
        $this->assertSame(600900, $after['totalEstimate']);
        $this->assertSame(0, $after['estimateAdjustment']['pendingMaterialsTotal']);
    }

    public function test_a_request_inside_the_plan_shows_no_impact(): void
    {
        $this->project->update(['auto_approve_materials' => false]);
        $id = $this->request([['supplier_product_id' => $this->cement->id, 'quantity' => 40]]);

        Sanctum::actingAs($this->homeowner);
        $this->getJson("/api/material-requests/{$id}")->assertOk()->assertJsonPath('canDecide', true)->assertJsonPath('estimateImpact', null);
    }

    public function test_only_the_homeowner_is_shown_the_impact(): void
    {
        $id = $this->request([['supplier_product_id' => $this->nails->id, 'quantity' => 10]]);

        Sanctum::actingAs($this->contractor);
        $this->getJson("/api/material-requests/{$id}")->assertOk()->assertJsonPath('estimateImpact', null);
    }

    // ---- hiring --------------------------------------------------------------------------------

    private function hire(User $worker, int $fixedWage): void
    {
        $this->project->workers()->attach($worker->id, ['wage_amount' => $fixedWage, 'wage_unit' => 'fixed', 'wage_auto' => false]);
    }

    public function test_hiring_within_the_labor_budget_changes_nothing(): void
    {
        $this->hire($this->user('worker'), 200000);

        $this->assertSame(600000, $this->dashboard()['totalEstimate']);
    }

    public function test_hiring_beyond_the_labor_budget_adds_the_excess(): void
    {
        $this->hire($this->user('worker'), 200000);
        $this->hire($this->user('worker'), 200000);     // ₱400,000 of wages against a ₱320,000 labor line

        $project = $this->dashboard();
        $this->assertSame(680000, $project['totalEstimate']);
        $this->assertSame(20000, $project['budget'] - $project['totalEstimate']);

        $addition = collect($project['estimateAdjustment']['additions'])->firstWhere('kind', 'workers');
        $this->assertSame(80000, $addition['amount']);
        $this->assertSame(400000, $addition['wages']);
        $this->assertSame(320000, $addition['budget']);
    }

    public function test_a_sudden_hire_moves_a_budget_that_was_already_full(): void
    {
        $this->hire($this->user('worker'), 320000);                    // exactly the labor line
        $this->assertSame(600000, $this->dashboard()['totalEstimate']);

        $this->hire($this->user('worker'), 15000);                     // one more person, all of it extra
        $this->assertSame(615000, $this->dashboard()['totalEstimate']);
    }

    public function test_contractor_fees_beyond_the_plans_fee_line_are_added_too(): void
    {
        $this->project = $this->makeProject(true, [['category' => 'Contractor and Project Management Fee', 'amount' => 50000]]);
        $this->project->contractors()->attach($this->contractor->id, ['wage_amount' => 70000, 'wage_unit' => 'fixed', 'wage_auto' => false]);

        $project = $this->dashboard();
        $addition = collect($project['estimateAdjustment']['additions'])->firstWhere('kind', 'contractors');
        $this->assertSame(20000, $addition['amount']);
        $this->assertSame(650000 + 20000, $project['totalEstimate']);   // the plan's total now includes the fee line (₱650,000)
    }

    public function test_a_plan_with_no_labor_line_gives_nothing_to_compare_hiring_against(): void
    {
        $project = app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Older plan', 'budget' => 700000, 'totalEstimate' => 600000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100]],
        ]);
        $project->workers()->attach($this->user('worker')->id, ['wage_amount' => 900000, 'wage_unit' => 'fixed', 'wage_auto' => false]);
        $this->project = $project;

        $this->assertSame(600000, $this->dashboard()['totalEstimate']);
    }

    // ---- nothing to measure against, and who sees it -------------------------------------------

    public function test_a_project_with_no_material_list_never_calls_an_order_unplanned(): void
    {
        $this->project = $this->makeProject(false);
        $this->project->contractors()->attach($this->contractor->id);

        $this->approve($this->request([['supplier_product_id' => $this->nails->id, 'quantity' => 10]]));

        $this->assertSame(600000, $this->dashboard()['totalEstimate']);
    }

    public function test_contractors_and_workers_keep_seeing_the_plans_own_estimate(): void
    {
        $this->approve($this->request([['supplier_product_id' => $this->nails->id, 'quantity' => 10]]));
        $worker = $this->user('worker');
        $this->project->workers()->attach($worker->id);

        foreach ([$this->contractor, $worker] as $viewer) {
            Sanctum::actingAs($viewer);
            $mine = collect($this->getJson('/api/my-projects')->assertOk()->json())->firstWhere('id', $this->project->id);

            $this->assertSame(600000, $mine['totalEstimate']);
            $this->assertNull($mine['estimateAdjustment']);
        }

        $this->assertSame(600900, $this->dashboard()['totalEstimate']);
    }
}
