<?php

namespace Tests\Feature;

use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\ConstructionPlanService;
use App\Services\ProjectService;
use App\Services\SupplierProductService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierPlanTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    private function supplier(string $name = 'Acme Supply'): User
    {
        return $this->user('supplier', ['name' => $name, 'business_name' => $name]);
    }

    private function product(User $supplier, string $name, string $category, int $price, array $overrides = []): SupplierProduct
    {
        return $supplier->supplierProducts()->create(array_merge([
            'name' => $name, 'category' => $category, 'unit' => 'bag', 'price' => $price, 'stock' => 100,
        ], $overrides));
    }

    /** @return array<string, mixed> */
    private function material(int $listingId, array $overrides = []): array
    {
        return array_merge([
            'material' => 'cement', 'category' => 'Structural', 'qty' => 100, 'unit' => 'sacks', 'unitPrice' => 999, 'supplierProductId' => $listingId,
        ], $overrides);
    }

    private function service(): ConstructionPlanService
    {
        return app(ConstructionPlanService::class);
    }

    // ---- server-side enforcement of what the AI claims it used ---------------------------------

    public function test_a_matched_material_takes_its_name_unit_and_price_from_the_real_listing(): void
    {
        $supplier = $this->supplier('Acme Supply');
        $cement = $this->product($supplier, 'Portland Cement 40kg', 'Cement', 265);

        $plan = $this->service()->applySupplierData(['materials' => [$this->material($cement->id)]], $this->service()->normalizeSelections([]));

        $this->assertSame('Portland Cement 40kg', $plan['materials'][0]['material']);
        $this->assertSame('bag', $plan['materials'][0]['unit']);
        $this->assertSame(265, $plan['materials'][0]['unitPrice']);
        $this->assertSame($supplier->id, $plan['materials'][0]['supplierId']);
        $this->assertSame('Acme Supply', $plan['materials'][0]['supplierName']);
        // The AI's quantity is the one thing it still decides.
        $this->assertSame(100, $plan['materials'][0]['qty']);
    }

    public function test_an_invented_or_unavailable_listing_is_dropped_back_to_an_estimate(): void
    {
        $supplier = $this->supplier();
        $inactive = $this->product($supplier, 'Retired Cement', 'Cement', 200, ['is_active' => false]);
        $pending = $this->product($this->user('supplier', ['approval_status' => 'pending']), 'Unapproved Cement', 'Cement', 100);

        $plan = $this->service()->applySupplierData(['materials' => [
            $this->material(987654),
            $this->material($inactive->id),
            $this->material($pending->id),
        ]], $this->service()->normalizeSelections([]));

        foreach ($plan['materials'] as $material) {
            $this->assertSame(0, $material['supplierProductId']);
            $this->assertSame(999, $material['unitPrice']);
            $this->assertArrayNotHasKey('supplierName', $material);
        }
    }

    public function test_a_listing_from_the_wrong_supplier_is_rejected_for_a_category_with_a_chosen_supplier(): void
    {
        $chosen = $this->supplier('Chosen Co');
        $other = $this->supplier('Cheaper Co');
        $fromOther = $this->product($other, 'Cheap Cement', 'Cement', 150);
        $fromChosen = $this->product($chosen, 'Chosen Cement', 'Cement', 300);

        $selections = $this->service()->normalizeSelections(['Construction Materials' => $chosen->id]);
        $plan = $this->service()->applySupplierData(['materials' => [
            $this->material($fromOther->id),
            $this->material($fromChosen->id),
        ]], $selections);

        $this->assertSame(0, $plan['materials'][0]['supplierProductId']);
        $this->assertSame($fromChosen->id, $plan['materials'][1]['supplierProductId']);
        $this->assertSame($chosen->id, $plan['supplierSelections']['Construction Materials']);
        $this->assertNull($plan['supplierSelections']['Finishing Works']);
    }

    public function test_a_choice_for_one_category_does_not_restrict_the_others(): void
    {
        $chosen = $this->supplier('Chosen Co');
        $other = $this->supplier('Other Co');
        $paint = $this->product($other, 'White Paint 4L', 'Paint', 900, ['unit' => 'can']);

        $plan = $this->service()->applySupplierData(
            ['materials' => [$this->material($paint->id)]],
            $this->service()->normalizeSelections(['Construction Materials' => $chosen->id])
        );

        $this->assertSame($paint->id, $plan['materials'][0]['supplierProductId']);
    }

    public function test_unknown_categories_and_junk_selections_are_ignored(): void
    {
        $selections = $this->service()->normalizeSelections(['Nonsense' => 5, 'Finishing Works' => 'abc', 'Electrical and Plumbing' => '7']);

        $this->assertSame(['Construction Materials' => null, 'Electrical and Plumbing' => 7, 'Finishing Works' => null], $selections);
    }

    public function test_every_listing_category_belongs_to_exactly_one_plan_category(): void
    {
        foreach (SupplierProduct::CATEGORIES as $category) {
            $this->assertNotNull(SupplierProduct::planCategoryFor($category), "{$category} has no plan category");
        }
    }

    // ---- what the AI is shown ------------------------------------------------------------------

    public function test_the_prompt_lists_only_the_chosen_suppliers_items_for_that_category(): void
    {
        $chosen = $this->supplier('Chosen Co');
        $other = $this->supplier('Other Co');
        $this->product($chosen, 'Chosen Cement', 'Cement', 300);
        $this->product($other, 'Other Cement', 'Cement', 150);
        $this->product($other, 'Other Paint', 'Paint', 800, ['unit' => 'can']);

        $context = app(SupplierProductService::class)->pricingContextForPrompt(['Construction Materials' => $chosen->id]);

        $this->assertStringContainsString('the homeowner chose Chosen Co', $context);
        $this->assertStringContainsString('Chosen Cement', $context);
        $this->assertStringNotContainsString('Other Cement', $context);
        // Finishing has no choice, so it shows the best available price with who sells it.
        $this->assertStringContainsString('Other Paint | can | ₱800 | Other Co', $context);
        $this->assertStringContainsString('| Other Co', $context);
    }

    public function test_without_a_choice_the_cheapest_listing_per_item_is_shown_with_its_supplier(): void
    {
        $a = $this->supplier('Pricey Co');
        $b = $this->supplier('Cheap Co');
        $this->product($a, 'Portland Cement', 'Cement', 300);
        $cheap = $this->product($b, 'Portland Cement', 'Cement', 250);

        $context = app(SupplierProductService::class)->pricingContextForPrompt();

        $this->assertStringContainsString("{$cheap->id} | Portland Cement | bag | ₱250 | Cheap Co", $context);
        $this->assertStringNotContainsString('₱300', $context);
        $this->assertStringContainsString('no supplier chosen', $context);
    }

    public function test_a_big_catalog_still_shows_every_kind_of_material_not_just_the_cheapest_odds_and_ends(): void
    {
        $supplier = $this->supplier('Big Shop');
        // The main line is listed first; far more cheaper odds and ends follow than the prompt has room for.
        $cement = $this->product($supplier, 'Portland Cement', 'Cement', 265);
        foreach (range(1, 30) as $i) {
            $this->product($supplier, "Cheap Fastener {$i}", 'Hardware', 5 + $i);
            $this->product($supplier, "Cement Additive {$i}", 'Cement', 10 + $i);
        }
        $sand = $this->product($supplier, 'Washed Sand', 'Sand', 1350);
        $gravel = $this->product($supplier, 'Gravel 3/4"', 'Gravel', 1500);
        $steel = $this->product($supplier, 'Rebar 10mm', 'Steel', 195);

        $chosen = app(SupplierProductService::class)->pricingContextForPrompt(['Construction Materials' => $supplier->id]);
        $auto = app(SupplierProductService::class)->pricingContextForPrompt();

        foreach ([$chosen, $auto] as $context) {
            $this->assertStringContainsString("{$cement->id} | Portland Cement", $context);
            $this->assertStringContainsString("{$sand->id} | Washed Sand", $context);
            $this->assertStringContainsString("{$gravel->id} | Gravel 3/4\"", $context);
            $this->assertStringContainsString("{$steel->id} | Rebar 10mm", $context);
        }
        // The cap still holds: 12 rows for a chosen supplier, 8 without a choice.
        $this->assertSame(12, substr_count($chosen, "\n") - 3);
        $this->assertSame(8, substr_count($auto, "\n") - 3);
    }

    public function test_out_of_stock_inactive_and_unapproved_listings_are_never_shown(): void
    {
        $supplier = $this->supplier();
        $this->product($supplier, 'Sold Out Cement', 'Cement', 100, ['stock' => 0]);
        $this->product($supplier, 'Retired Cement', 'Cement', 100, ['is_active' => false]);
        $this->product($this->user('supplier', ['approval_status' => 'pending']), 'Unapproved Cement', 'Cement', 100);

        $this->assertSame('', app(SupplierProductService::class)->pricingContextForPrompt());
    }

    // ---- the supplier picker -------------------------------------------------------------------

    public function test_supplier_options_group_suppliers_by_the_plan_category_they_can_supply(): void
    {
        $builder = $this->supplier('Builders Depot');
        $sparky = $this->supplier('Sparky & Pipes');
        $this->product($builder, 'Cement', 'Cement', 265);
        $this->product($builder, 'Rebar', 'Steel', 500, ['stock' => 0]);
        $this->product($sparky, 'Wire', 'Electrical', 90);
        $this->product($sparky, 'PVC Pipe', 'Plumbing', 120);

        Sanctum::actingAs($this->user('homeowner'));
        $response = $this->getJson('/api/ai/supplier-options')->assertOk();

        $byCategory = collect($response->json())->keyBy('category');
        $this->assertSame(['Construction Materials', 'Electrical and Plumbing', 'Finishing Works'], $byCategory->keys()->all());

        $construction = $byCategory['Construction Materials']['suppliers'];
        $this->assertCount(1, $construction);
        $this->assertSame('Builders Depot', $construction[0]['name']);
        $this->assertSame(2, $construction[0]['itemCount']);
        $this->assertSame(1, $construction[0]['inStockCount']);

        $this->assertSame(2, $byCategory['Electrical and Plumbing']['suppliers'][0]['itemCount']);
        $this->assertSame([], $byCategory['Finishing Works']['suppliers']);
    }

    public function test_only_homeowners_can_see_supplier_options(): void
    {
        Sanctum::actingAs($this->user('contractor'));
        $this->getJson('/api/ai/supplier-options')->assertForbidden();
    }

    public function test_a_chosen_supplier_must_be_a_real_approved_supplier(): void
    {
        Sanctum::actingAs($this->user('homeowner'));
        $contractor = $this->user('contractor');

        $this->postJson('/api/ai/plan', [
            'messages' => [['role' => 'user', 'content' => 'hi']],
            'supplier_selections' => ['Construction Materials' => $contractor->id],
        ])->assertStatus(422)->assertJsonValidationErrors('supplier_selections.Construction Materials');
    }

    // ---- end to end through the planner --------------------------------------------------------

    private function toolCallStream(array $plan): string
    {
        $delta = ['tool_calls' => [['function' => ['name' => 'submit_construction_plan', 'arguments' => json_encode($plan)]]]];

        return 'data: '.json_encode(['choices' => [['delta' => $delta]]])."\n\ndata: [DONE]\n\n";
    }

    /** @return array<string, mixed> */
    private function aiPlan(array $materials): array
    {
        $categories = ['Foundation and Excavation', 'Construction Materials', 'Labor Costs', 'Contractor and Project Management Fee', 'Electrical and Plumbing', 'Finishing Works'];

        return [
            'projectTitle' => 'House', 'location' => '', 'areaSqm' => 100, 'floors' => 1, 'bedrooms' => 2, 'bathrooms' => 1, 'garageCars' => 0,
            'designStyle' => 'Modern', 'budget' => 0, 'timelineMonths' => 6,
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'durationWeeks' => 26, 'tasks' => ['Pour slab']]],
            'budgetBreakdown' => array_map(fn (string $c) => ['category' => $c, 'amount' => 100000], $categories),
            'materials' => $materials,
            'exteriorConcept' => 'x', 'interiorConcept' => 'y', 'totalEstimate' => 600000,
        ];
    }

    public function test_the_planner_shows_the_ai_the_chosen_suppliers_listings_and_enforces_what_comes_back(): void
    {
        config(['services.groq.key' => 'test-key']);
        $chosen = $this->supplier('Chosen Co');
        $other = $this->supplier('Other Co');
        $good = $this->product($chosen, 'Chosen Cement', 'Cement', 300);
        $wrong = $this->product($other, 'Other Cement', 'Cement', 150);

        Http::fake(['api.groq.com/*' => Http::response($this->toolCallStream($this->aiPlan([
            $this->material($good->id, ['qty' => 50]),
            $this->material($wrong->id, ['material' => 'more cement']),
        ])), 200)]);

        $plan = $this->service()->generate(
            [['role' => 'user', 'content' => 'build a house, no garage']],
            true,
            fn () => null,
            null,
            ['Construction Materials' => $chosen->id]
        );

        Http::assertSent(function (Request $request) use ($good) {
            $system = $request->data()['messages'][0]['content'];

            return str_contains($system, "{$good->id} | Chosen Cement")
                && ! str_contains($system, 'Other Cement')
                && str_contains($system, 'the homeowner chose Chosen Co');
        });

        $this->assertSame($good->id, $plan['materials'][0]['supplierProductId']);
        $this->assertSame(300, $plan['materials'][0]['unitPrice']);
        $this->assertSame('Chosen Co', $plan['materials'][0]['supplierName']);
        // The AI tried to slip in the other supplier's listing; it's an estimate again.
        $this->assertSame(0, $plan['materials'][1]['supplierProductId']);
        $this->assertSame(['Construction Materials' => $chosen->id, 'Electrical and Plumbing' => null, 'Finishing Works' => null], $plan['supplierSelections']);
    }

    // ---- carried through to the contractor -----------------------------------------------------

    public function test_the_contractors_material_request_starts_from_the_listing_the_homeowner_chose(): void
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $cheap = $this->product($this->supplier('Cheap Co'), 'Portland Cement', 'Cement', 150);
        $chosen = $this->product($this->supplier('Chosen Co'), 'Portland Cement', 'Cement', 300);

        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'House', 'budget' => 0, 'totalEstimate' => 600000, 'timelineMonths' => 6,
            'phases' => [['name' => 'Build', 'percentComplete' => 100]],
            'materials' => [['material' => 'Portland Cement', 'category' => 'Cement', 'qty' => 10, 'unit' => 'bag', 'unitPrice' => 300, 'supplierProductId' => $chosen->id, 'supplierName' => 'Chosen Co']],
        ]);
        $project->contractors()->attach($contractor->id);

        Sanctum::actingAs($contractor);
        $this->getJson("/api/projects/{$project->id}/ai-materials")
            ->assertOk()
            ->assertJsonPath('0.match.supplierProductId', $chosen->id)
            ->assertJsonPath('0.match.supplierName', 'Chosen Co');

        // Without a chosen listing it still falls back to the cheapest same-named one.
        $project->update(['ai_materials' => [['material' => 'Portland Cement', 'category' => 'Cement', 'qty' => 10, 'unit' => 'bag', 'unitPrice' => 300]]]);
        $this->getJson("/api/projects/{$project->id}/ai-materials")->assertJsonPath('0.match.supplierProductId', $cheap->id);
    }
}
