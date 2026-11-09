<?php

namespace Tests\Feature;

use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\SupplierFulfillment;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\ConstructionPlanService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaterialPlanTest extends TestCase
{
    use RefreshDatabase;

    private User $homeowner;

    private User $contractor;

    private User $supplierA;

    private User $supplierB;

    private Project $project;

    private ProjectPhase $foundation;

    private ProjectPhase $roofing;

    private SupplierProduct $cement;

    private SupplierProduct $rebar;

    private SupplierProduct $roofSheet;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2027-01-01 09:00:00');

        $this->homeowner = $this->user('homeowner');
        $this->contractor = $this->user('contractor');
        $this->supplierA = $this->user('supplier', ['business_name' => 'Alpha Hardware']);
        $this->supplierB = $this->user('supplier', ['business_name' => 'Bravo Steel']);

        $this->cement = $this->supplierA->supplierProducts()->create(['name' => 'Portland Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 280, 'stock' => 500]);
        $this->rebar = $this->supplierA->supplierProducts()->create(['name' => 'Rebar 10mm', 'category' => 'Steel', 'unit' => 'kg', 'price' => 70, 'stock' => 1000]);
        $this->roofSheet = $this->supplierA->supplierProducts()->create(['name' => 'GI Roofing Sheet', 'category' => 'Roofing', 'unit' => 'pc', 'price' => 400, 'stock' => 500]);

        $this->project = app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Dela Cruz Residence', 'budget' => 0, 'totalEstimate' => 600000, 'timelineMonths' => 6,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 40, 'durationWeeks' => 8],
                ['name' => 'Roofing', 'percentComplete' => 60, 'durationWeeks' => 18],
            ],
            'budgetBreakdown' => [
                ['category' => 'Construction Materials', 'amount' => 200000],
                ['category' => 'Electrical and Plumbing', 'amount' => 50000],
                ['category' => 'Finishing Works', 'amount' => 30000],
                ['category' => 'Labor Costs', 'amount' => 320000],
            ],
            'supplierSelections' => ['Construction Materials' => $this->supplierA->id, 'Electrical and Plumbing' => null, 'Finishing Works' => null],
            'materials' => [
                ['material' => 'Portland Cement', 'category' => 'Cement', 'qty' => 54, 'unit' => 'bag', 'unitPrice' => 280, 'supplierProductId' => $this->cement->id, 'supplierName' => 'Alpha Hardware', 'phase' => 'Foundation'],
                ['material' => 'Rebar 10mm', 'category' => 'Steel', 'qty' => 200, 'unit' => 'kg', 'unitPrice' => 70, 'supplierProductId' => $this->rebar->id, 'supplierName' => 'Alpha Hardware', 'phase' => 'Foundation'],
                ['material' => 'GI Roofing Sheet', 'category' => 'Roofing', 'qty' => 100, 'unit' => 'pc', 'unitPrice' => 400, 'supplierProductId' => $this->roofSheet->id, 'supplierName' => 'Alpha Hardware', 'phase' => 'Roofing'],
                ['material' => 'Mystery Item', 'category' => 'Other', 'qty' => 5, 'unit' => 'box', 'unitPrice' => 100, 'supplierProductId' => 0, 'phase' => ''],
            ],
        ]);
        $this->project->contractors()->attach($this->contractor->id);
        $this->foundation = $this->project->phases()->where('name', 'Foundation')->firstOrFail();
        $this->roofing = $this->project->phases()->where('name', 'Roofing')->firstOrFail();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    private function plan(User $viewer)
    {
        Sanctum::actingAs($viewer);

        return $this->getJson("/api/projects/{$this->project->id}/material-plan");
    }

    /** The contractor's one-off review: cement is really 60 bags, plus 10% waste. */
    private function review(array $lines = [['index' => 0, 'quantity' => 60, 'waste_pct' => 10]])
    {
        Sanctum::actingAs($this->contractor);

        return $this->putJson("/api/projects/{$this->project->id}/material-plan/review", ['lines' => $lines]);
    }

    private function requestPhase(ProjectPhase $phase, ?User $as = null)
    {
        Sanctum::actingAs($as ?? $this->contractor);

        return $this->postJson("/api/projects/{$this->project->id}/material-plan/phases/{$phase->id}/request");
    }

    private function submit(int $requestId)
    {
        Sanctum::actingAs($this->contractor);

        return $this->postJson("/api/material-requests/{$requestId}/submit");
    }

    /** Edits the saved plan's budget, as if the homeowner had approved a different one. */
    private function setBudget(string $category, int $amount): void
    {
        $plan = $this->project->fresh()->approved_plan;
        foreach ($plan['budgetBreakdown'] as &$line) {
            if ($line['category'] === $category) {
                $line['amount'] = $amount;
            }
        }
        $this->project->update(['approved_plan' => $plan]);
    }

    // ---- 1. materials by phase, due by date ----------------------------------------------------

    public function test_the_ai_plans_phase_names_are_held_to_the_plans_real_phases(): void
    {
        $plan = app(ConstructionPlanService::class)->normalizeMaterialPhases([
            'phases' => [['name' => 'Site Preparation'], ['name' => 'Roofing']],
            'materials' => [
                ['material' => 'a', 'phase' => 'roofing '],
                ['material' => 'b', 'phase' => 'site  preparation'],
                ['material' => 'c', 'phase' => 'Landscaping'],
                ['material' => 'd'],
            ],
        ]);

        $this->assertSame(['Roofing', 'Site Preparation', '', ''], array_column($plan['materials'], 'phase'));
    }

    public function test_the_plan_groups_materials_by_phase_with_a_needed_by_date_from_the_calendar(): void
    {
        $response = $this->plan($this->contractor)->assertOk();

        $phases = collect($response->json('phases'))->keyBy('name');
        $this->assertSame(['Foundation', 'Roofing'], $phases->keys()->all());
        $this->assertSame(2, $phases['Foundation']['lineCount']);
        // 15120 cement + 14000 rebar.
        $this->assertSame(29120, $phases['Foundation']['estimatedTotal']);
        $this->assertSame('2027-01-01', $phases['Foundation']['startDate']);
        $this->assertSame('2026-12-25', $phases['Foundation']['neededBy']);
        // The foundation's order date has already passed.
        $this->assertSame(-7, $phases['Foundation']['daysUntilNeeded']);
        $this->assertSame('2027-02-26', $phases['Roofing']['startDate']);
        $this->assertSame('2027-02-19', $phases['Roofing']['neededBy']);
        $this->assertSame(1, $response->json('unscheduled.lineCount'));
        $this->assertSame('Mystery Item', $response->json('unscheduled.lines.0.material'));
    }

    public function test_the_plan_carries_the_budget_room_per_category(): void
    {
        $budgets = collect($this->plan($this->homeowner)->assertOk()->json('categoryBudgets'))->keyBy('category');

        $this->assertSame(200000, $budgets['Construction Materials']['budget']);
        $this->assertSame(0, $budgets['Construction Materials']['committed']);
        $this->assertSame(200000, $budgets['Construction Materials']['remaining']);
        $this->assertFalse($budgets->has('Labor Costs'));
    }

    public function test_only_the_owner_and_assigned_contractors_see_the_plan(): void
    {
        $this->plan($this->homeowner)->assertOk();
        $this->plan($this->contractor)->assertOk();

        $this->plan($this->user('contractor'))->assertStatus(422);
        $this->plan($this->user('homeowner'))->assertStatus(422);
        $this->plan($this->user('worker'))->assertForbidden();
        $this->plan($this->user('supplier'))->assertForbidden();
    }

    // ---- 2. the contractor reviews the AI's quantities once ------------------------------------

    public function test_the_contractors_review_sets_the_planned_quantity_with_waste(): void
    {
        $response = $this->review()->assertOk();

        $cement = collect($response->json('phases.0.lines'))->firstWhere('material', 'Portland Cement');
        $this->assertSame(54, $cement['aiQuantity']);
        $this->assertSame(66, $cement['quantity']);     // ceil(60 × 1.10)
        $this->assertSame(10, $cement['wastePct']);
        $this->assertTrue($cement['reviewed']);
        // Lines they didn't touch keep the AI's quantity.
        $this->assertSame(200, collect($response->json('phases.0.lines'))->firstWhere('material', 'Rebar 10mm')['quantity']);

        $response->assertJsonPath('reviewed', true)->assertJsonPath('reviewedBy', $this->contractor->name);
        $this->assertNotNull($this->project->fresh()->materials_reviewed_at);
    }

    public function test_the_homeowner_sees_how_the_review_compares_with_the_ai(): void
    {
        $this->review()->assertOk();

        $plan = $this->plan($this->homeowner)->assertOk();
        // +12 cement bags at ₱280 on a plan worth ₱15,120 + 14,000 + 40,000 + 500 = ₱69,620 → +3,360.
        $this->assertSame(69620, $plan->json('aiTotal'));
        $this->assertSame(72980, $plan->json('plannedTotal'));
        $this->assertSame(5, $plan->json('variancePct'));
    }

    public function test_the_homeowner_is_told_when_the_quantities_are_reviewed(): void
    {
        $this->review()->assertOk();

        $note = $this->homeowner->appNotifications()->where('type', 'materials_reviewed')->first();
        $this->assertNotNull($note);
        $this->assertStringContainsString('1 of 4 lines changed', $note->body);
        $this->assertSame($this->project->id, $note->data['projectId']);
    }

    public function test_a_review_must_name_real_lines_and_sensible_numbers(): void
    {
        $this->review([['index' => 99, 'quantity' => 5]])->assertStatus(422);
        $this->review([['index' => 0, 'quantity' => 0]])->assertStatus(422)->assertJsonValidationErrors('lines.0.quantity');
        $this->review([['index' => 0, 'quantity' => 5, 'waste_pct' => 80]])->assertStatus(422)->assertJsonValidationErrors('lines.0.waste_pct');
    }

    public function test_only_a_contractor_on_the_project_can_review(): void
    {
        Sanctum::actingAs($this->homeowner);
        $this->putJson("/api/projects/{$this->project->id}/material-plan/review", ['lines' => []])->assertForbidden();

        Sanctum::actingAs($this->user('contractor'));
        $this->putJson("/api/projects/{$this->project->id}/material-plan/review", ['lines' => []])->assertStatus(422);
    }

    public function test_a_phase_request_cannot_be_made_before_the_review(): void
    {
        $this->requestPhase($this->foundation)->assertStatus(422)->assertJsonPath('error', fn ($e) => str_contains($e, 'Review the AI material quantities'));
    }

    // ---- per-phase requests --------------------------------------------------------------------

    public function test_a_phase_request_is_drafted_from_the_reviewed_plan(): void
    {
        $this->review()->assertOk();

        $response = $this->requestPhase($this->foundation)->assertCreated();

        $response->assertJsonPath('status', 'draft')
            ->assertJsonPath('phase.name', 'Foundation')
            ->assertJsonPath('neededBy', '2026-12-25')
            ->assertJsonCount(2, 'items');

        $cement = collect($response->json('items'))->firstWhere('materialName', 'Portland Cement');
        $this->assertSame(66, $cement['quantity']);
        $this->assertSame(54, $cement['aiQuantity']);
        $this->assertSame(66, $cement['planQuantity']);
        $this->assertSame(10, $cement['wastePct']);
        $this->assertSame($this->supplierA->id, $cement['supplierId']);
        $this->assertSame('ai', $cement['source']);
        $this->assertSame(66 * 280 + 200 * 70, $response->json('estimatedTotal'));
    }

    public function test_asking_for_a_phase_again_resumes_the_draft_and_never_doubles_up(): void
    {
        $this->review()->assertOk();
        $first = $this->requestPhase($this->foundation)->assertCreated()->json('id');

        $this->assertSame($first, $this->requestPhase($this->foundation)->json('id'));
        $this->assertSame(1, MaterialRequest::where('phase_id', $this->foundation->id)->count());
    }

    public function test_a_phase_already_requested_cannot_be_requested_again(): void
    {
        $this->review()->assertOk();
        $id = $this->requestPhase($this->foundation)->json('id');
        $this->setBudget('Construction Materials', 1); // keeps it pending, whatever else is true
        $this->submit($id)->assertOk()->assertJsonPath('status', 'pending_homeowner_approval');

        $this->requestPhase($this->foundation)->assertStatus(422);
    }

    public function test_a_phase_with_no_planned_materials_cannot_be_requested(): void
    {
        $this->review()->assertOk();
        $empty = $this->project->phases()->create(['name' => 'Landscaping', 'sort_order' => 9, 'weight_pct' => 0, 'progress_pct' => 0]);

        $this->requestPhase($empty)->assertStatus(422);
    }

    public function test_only_a_contractor_on_the_project_can_request_a_phase(): void
    {
        $this->review()->assertOk();

        $this->requestPhase($this->foundation, $this->homeowner)->assertForbidden();
        $this->requestPhase($this->foundation, $this->user('contractor'))->assertStatus(422);
    }

    public function test_a_phase_from_another_project_is_not_found(): void
    {
        $this->review()->assertOk();
        $other = app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Other', 'budget' => 0, 'totalEstimate' => 1000, 'timelineMonths' => 1,
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100]],
        ]);

        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/projects/{$this->project->id}/material-plan/phases/{$other->phases->first()->id}/request")->assertNotFound();
    }

    public function test_the_ai_import_uses_the_reviewed_quantities(): void
    {
        $this->review()->assertOk();

        Sanctum::actingAs($this->contractor);
        $cement = collect($this->getJson("/api/projects/{$this->project->id}/ai-materials")->assertOk()->json())->firstWhere('material', 'Portland Cement');
        $this->assertSame(66, $cement['quantity']);
        $this->assertSame(54, $cement['aiQuantity']);
    }

    // ---- 3. approval by exception --------------------------------------------------------------

    public function test_a_request_inside_the_plan_approves_itself(): void
    {
        $this->review()->assertOk();
        $id = $this->requestPhase($this->foundation)->json('id');

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'approved')->assertJsonPath('autoApproved', true)->assertJsonPath('approvalFlags', []);
        $this->assertSame(1, SupplierFulfillment::where('material_request_id', $id)->count());
        $this->assertSame('supplier_review', SupplierFulfillment::where('material_request_id', $id)->first()->status);

        // The history says the system did it, and why — not the homeowner.
        $approval = collect($response->json('history'))->firstWhere('newStatus', 'approved');
        $this->assertNull($approval['by']);
        $this->assertStringContainsString('Auto-approved', $approval['reason']);
    }

    public function test_everyone_is_told_about_an_automatic_approval(): void
    {
        $this->review()->assertOk();
        $id = $this->requestPhase($this->foundation)->json('id');
        $this->submit($id)->assertOk();

        $this->assertNotNull($this->homeowner->appNotifications()->where('type', 'material_request_auto_approved')->first());
        $this->assertNotNull($this->contractor->appNotifications()->where('type', 'material_request_approved')->first());
        $this->assertNotNull($this->supplierA->appNotifications()->where('type', 'supplier_fulfillment_received')->first());
        // No "needs your approval" prompt for something that didn't need it.
        $this->assertNull($this->homeowner->appNotifications()->where('type', 'material_request_submitted')->first());
    }

    public function test_a_request_over_the_category_budget_waits_for_the_homeowner_with_the_reason(): void
    {
        $this->review()->assertOk();
        $this->setBudget('Construction Materials', 20000); // the foundation needs 66×280 + 200×70 = 32,480
        $id = $this->requestPhase($this->foundation)->json('id');

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval')->assertJsonPath('autoApproved', false);
        $this->assertStringContainsString('Construction Materials would be ₱12,480 over the plan budget of ₱20,000', $response->json('approvalFlags.0'));
        $this->assertSame(0, SupplierFulfillment::where('material_request_id', $id)->count());
        // The homeowner's prompt carries the reason.
        $note = $this->homeowner->appNotifications()->where('type', 'material_request_submitted')->first();
        $this->assertStringContainsString('over the plan budget', $note->body);
    }

    public function test_spending_so_far_counts_against_the_budget(): void
    {
        $this->review()->assertOk();
        $this->setBudget('Construction Materials', 40000);

        // Foundation (₱32,480) fits and goes through...
        $foundation = $this->requestPhase($this->foundation)->json('id');
        $this->submit($foundation)->assertJsonPath('status', 'approved');
        // ...but roofing (₱40,000) would take the category past ₱40,000 in total.
        $roofing = $this->requestPhase($this->roofing)->json('id');
        $response = $this->submit($roofing)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval');
        $this->assertStringContainsString('over the plan budget', $response->json('approvalFlags.0'));
        $budgets = collect($this->plan($this->homeowner)->json('categoryBudgets'))->keyBy('category');
        $this->assertSame(32480, $budgets['Construction Materials']['committed']);
    }

    public function test_a_cancelled_request_frees_its_budget(): void
    {
        $this->review()->assertOk();
        $this->setBudget('Construction Materials', 40000);
        $foundation = $this->requestPhase($this->foundation)->json('id');
        $this->submit($foundation)->assertJsonPath('status', 'approved');

        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$foundation}/cancel", ['reason' => 'Changed plan'])->assertOk();

        $roofing = $this->requestPhase($this->roofing)->json('id');
        $this->submit($roofing)->assertJsonPath('status', 'approved');
    }

    public function test_an_item_from_a_supplier_the_homeowner_did_not_choose_is_flagged(): void
    {
        $this->review()->assertOk();
        $other = $this->supplierB->supplierProducts()->create(['name' => 'Portland Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 250, 'stock' => 500]);
        $id = $this->requestPhase($this->foundation)->json('id');

        Sanctum::actingAs($this->contractor);
        $items = collect($this->getJson("/api/material-requests/{$id}")->json('items'));
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['id' => $items->firstWhere('materialName', 'Portland Cement')['id'], 'supplier_product_id' => $other->id, 'quantity' => 66],
            ['id' => $items->firstWhere('materialName', 'Rebar 10mm')['id'], 'supplier_product_id' => $this->rebar->id, 'quantity' => 200],
        ]])->assertOk();

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval');
        $this->assertContains("“Portland Cement” isn't from your chosen supplier for Construction Materials.", $response->json('approvalFlags'));
    }

    public function test_a_quantity_above_the_plan_is_flagged(): void
    {
        $this->review()->assertOk();
        $id = $this->requestPhase($this->foundation)->json('id');

        Sanctum::actingAs($this->contractor);
        $items = collect($this->getJson("/api/material-requests/{$id}")->json('items'));
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['id' => $items->firstWhere('materialName', 'Portland Cement')['id'], 'supplier_product_id' => $this->cement->id, 'quantity' => 80],
            ['id' => $items->firstWhere('materialName', 'Rebar 10mm')['id'], 'supplier_product_id' => $this->rebar->id, 'quantity' => 200],
        ]])->assertOk();

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval');
        $this->assertContains('“Portland Cement”: 80 in total is more than the plan\'s 66 bag.', $response->json('approvalFlags'));
    }

    public function test_the_plans_quantity_is_a_total_across_requests(): void
    {
        $this->review()->assertOk();
        $first = $this->requestPhase($this->foundation)->json('id');
        $this->submit($first)->assertJsonPath('status', 'approved');

        // A second, hand-built request for the same cement: 66 are already ordered.
        Sanctum::actingAs($this->contractor);
        $second = $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->json('id');
        $this->putJson("/api/material-requests/{$second}", ['items' => [['supplier_product_id' => $this->cement->id, 'quantity' => 5]]])->assertOk();

        $response = $this->submit($second)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval');
        $this->assertContains('“Portland Cement”: 71 in total is more than the plan\'s 66 bag.', $response->json('approvalFlags'));
    }

    public function test_an_item_that_is_not_in_the_plan_is_flagged_and_the_client_cannot_vouch_for_it(): void
    {
        $this->review()->assertOk();
        $nails = $this->supplierA->supplierProducts()->create(['name' => 'Common Nails', 'category' => 'Hardware', 'unit' => 'kg', 'price' => 90, 'stock' => 500]);

        Sanctum::actingAs($this->contractor);
        $id = $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->json('id');
        // Trying to claim a plan quantity for it is simply ignored.
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['supplier_product_id' => $nails->id, 'quantity' => 10, 'source' => 'ai', 'plan_quantity' => 1000, 'ai_quantity' => 1000],
        ]])->assertOk();

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval')->assertJsonPath('items.0.planQuantity', null);
        $this->assertContains("“Common Nails” isn't in your approved plan.", $response->json('approvalFlags'));
    }

    public function test_an_item_the_supplier_cannot_cover_is_flagged(): void
    {
        $this->review()->assertOk();
        $this->cement->update(['stock' => 10]);
        $id = $this->requestPhase($this->foundation)->json('id');

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval');
        $this->assertContains('“Portland Cement”: the supplier only has 10 bag in stock.', $response->json('approvalFlags'));
    }

    public function test_the_homeowner_can_switch_automatic_approval_off(): void
    {
        $this->review()->assertOk();

        Sanctum::actingAs($this->homeowner);
        $this->patchJson("/api/projects/{$this->project->id}/material-settings", ['auto_approve_materials' => false])
            ->assertOk()->assertJsonPath('autoApprove', false);
        $this->getJson("/api/dashboard?project_id={$this->project->id}")->assertJsonPath('project.autoApproveMaterials', false);

        $id = $this->requestPhase($this->foundation)->json('id');
        $response = $this->submit($id)->assertOk();

        // Their choice: it waits, and nothing is "wrong" with it.
        $response->assertJsonPath('status', 'pending_homeowner_approval')->assertJsonPath('approvalFlags', []);
    }

    public function test_only_the_owner_can_change_the_setting(): void
    {
        Sanctum::actingAs($this->contractor);
        $this->patchJson("/api/projects/{$this->project->id}/material-settings", ['auto_approve_materials' => false])->assertForbidden();

        Sanctum::actingAs($this->user('homeowner'));
        $this->patchJson("/api/projects/{$this->project->id}/material-settings", ['auto_approve_materials' => false])->assertStatus(422);
        $this->assertTrue((bool) $this->project->fresh()->auto_approve_materials);
    }

    public function test_a_project_with_no_plan_budget_never_approves_itself(): void
    {
        $this->review()->assertOk();
        $this->project->update(['approved_plan' => array_diff_key($this->project->approved_plan, ['budgetBreakdown' => 1])]);
        $id = $this->requestPhase($this->foundation)->json('id');

        $response = $this->submit($id)->assertOk();

        $response->assertJsonPath('status', 'pending_homeowner_approval');
        $this->assertStringContainsString('no approved plan budget', $response->json('approvalFlags.0'));
    }

    public function test_the_homeowner_still_decides_a_flagged_request_as_before(): void
    {
        $this->review()->assertOk();
        $this->setBudget('Construction Materials', 20000);
        $id = $this->requestPhase($this->foundation)->json('id');
        $this->submit($id)->assertJsonPath('status', 'pending_homeowner_approval');

        Sanctum::actingAs($this->homeowner);
        $this->getJson("/api/material-requests/{$id}")->assertJsonPath('canDecide', true)->assertJsonCount(1, 'approvalFlags');
        $this->postJson("/api/material-requests/{$id}/approve")->assertOk()->assertJsonPath('status', 'approved')->assertJsonPath('autoApproved', false);
    }
}
