<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\ProjectService;
use App\Support\PlanMaterials;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Importing the AI estimate into a material request: the AI words materials its own way ("Portland cement 40kg
 * bag"), so a line should still find the listing it means — and the picker should still find it when it can't.
 */
class AiImportMatchTest extends TestCase
{
    use RefreshDatabase;

    private User $homeowner;

    private User $contractor;

    private User $alpha;

    private User $bravo;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->homeowner = $this->user('homeowner');
        $this->contractor = $this->user('contractor');
        $this->alpha = $this->user('supplier', ['business_name' => 'Alpha Hardware']);
        $this->bravo = $this->user('supplier', ['business_name' => 'Bravo Steel']);

        $this->project = app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Reyes Residence',
            'location' => 'Cebu',
            'budget' => 2500000,
            'totalEstimate' => 2400000,
            'timelineMonths' => 6,
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100]],
            'materials' => [
                ['material' => 'Portland cement 40kg bag', 'category' => 'Cement', 'qty' => 100, 'unit' => 'bag', 'unitPrice' => 250],
                ['material' => 'Deformed rebar 10mm', 'category' => 'Steel', 'qty' => 300, 'unit' => 'kg', 'unitPrice' => 65],
                ['material' => 'Mystery Tiles', 'category' => 'Other', 'qty' => 40, 'unit' => 'box', 'unitPrice' => 900],
            ],
        ]);
        $this->project->contractors()->attach($this->contractor->id);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    private function listing(User $supplier, string $name, string $category, string $unit, int $price): SupplierProduct
    {
        return $supplier->supplierProducts()->create(['name' => $name, 'category' => $category, 'unit' => $unit, 'price' => $price, 'stock' => 1000]);
    }

    private function suggestions(): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($this->contractor);

        return $this->getJson("/api/projects/{$this->project->id}/ai-materials")->assertStatus(200);
    }

    public function test_a_differently_worded_line_gets_its_closest_listing(): void
    {
        $cement = $this->listing($this->alpha, 'Portland Cement 40kg', 'Cement', 'bag', 280);
        $this->listing($this->alpha, 'Cement Mixer 2HP', 'Hardware', 'piece', 18000);

        $this->suggestions()
            ->assertJsonPath('0.match.supplierProductId', $cement->id)
            ->assertJsonPath('0.matchKind', 'similar');
    }

    public function test_a_listing_with_the_exact_name_is_still_an_exact_match(): void
    {
        $cement = $this->listing($this->alpha, 'Portland cement  40KG bag', 'Cement', 'bag', 280);

        $this->suggestions()
            ->assertJsonPath('0.match.supplierProductId', $cement->id)
            ->assertJsonPath('0.matchKind', 'exact');
    }

    public function test_a_different_size_is_not_a_match(): void
    {
        $this->listing($this->bravo, 'Deformed Rebar 12mm', 'Steel', 'kg', 70);

        $this->suggestions()
            ->assertJsonPath('1.match', null)
            ->assertJsonPath('1.matchKind', null);
    }

    public function test_a_line_nothing_resembles_has_no_match(): void
    {
        $this->listing($this->alpha, 'Portland Cement 40kg', 'Cement', 'bag', 280);

        $this->suggestions()
            ->assertJsonPath('2.material', 'Mystery Tiles')
            ->assertJsonPath('2.match', null)
            ->assertJsonPath('2.matchKind', null);
    }

    public function test_the_homeowners_chosen_supplier_wins_a_near_tie(): void
    {
        $this->listing($this->alpha, 'Portland Cement 40kg', 'Cement', 'bag', 270);
        $chosen = $this->listing($this->bravo, 'Portland Cement 40kg', 'Cement', 'bag', 290);
        $this->project->update(['approved_plan' => ['supplierSelections' => ['Construction Materials' => $this->bravo->id]]]);

        // Both are the same distance from the AI's wording; Alpha is cheaper but Bravo is who the homeowner chose.
        $this->suggestions()->assertJsonPath('0.match.supplierProductId', $chosen->id);
    }

    public function test_a_closest_listing_counts_as_the_plans_material_when_requested(): void
    {
        $cement = $this->listing($this->alpha, 'Portland Cement 40kg', 'Cement', 'bag', 280);

        Sanctum::actingAs($this->contractor);
        $id = $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->json('id');
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['supplier_product_id' => $cement->id, 'quantity' => 100, 'source' => 'ai'],
        ]])
            ->assertStatus(200)
            ->assertJsonPath('items.0.aiQuantity', 100)
            ->assertJsonPath('items.0.planQuantity', 100);
    }

    public function test_an_unrelated_listing_is_not_taken_for_a_plan_material(): void
    {
        $mixer = $this->listing($this->alpha, 'Cement Mixer 2HP', 'Hardware', 'piece', 18000);

        Sanctum::actingAs($this->contractor);
        $id = $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->json('id');
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['supplier_product_id' => $mixer->id, 'quantity' => 1],
        ]])->assertStatus(200)->assertJsonPath('items.0.planQuantity', null);
    }

    public function test_similarity_needs_matching_sizes_and_a_shared_word(): void
    {
        $this->assertGreaterThan(0, PlanMaterials::similarity('Portland cement 40kg bag', 'Portland Cement 40 kg'));
        $this->assertGreaterThan(0, PlanMaterials::similarity('Hollow blocks', 'Hollow Block 4 inch'));
        $this->assertSame(0.0, PlanMaterials::similarity('Rebar 10mm', 'Rebar 12mm'));
        $this->assertSame(0.0, PlanMaterials::similarity('Plywood 1/2 inch', 'Marine Plywood 3/4 inch'));
        $this->assertSame(0.0, PlanMaterials::similarity('Cement 40kg', 'Paint 40kg'));
        $this->assertSame(0.0, PlanMaterials::similarity('', 'Anything'));
    }

    public function test_the_picker_finds_close_listings_for_a_long_ai_name(): void
    {
        $cement = $this->listing($this->alpha, 'Portland Cement 40kg', 'Cement', 'bag', 280);
        $this->listing($this->alpha, 'Rebar 10mm', 'Steel', 'kg', 70);

        Sanctum::actingAs($this->contractor);
        // "bag" isn't in the listing's name, so no listing has every word — the closest still come back.
        $this->getJson('/api/materials?search='.rawurlencode('Portland cement 40kg bag'))
            ->assertStatus(200)
            ->assertJsonPath('0.id', $cement->id);

        // Words match in any order, and when every word is there nothing else is dragged in.
        $this->getJson('/api/materials?search='.rawurlencode('40kg portland'))
            ->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $cement->id);

        $this->getJson('/api/materials?search=zzzz')->assertStatus(200)->assertJsonCount(0);
    }
}
