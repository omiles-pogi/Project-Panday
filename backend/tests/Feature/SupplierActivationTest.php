<?php

namespace Tests\Feature;

use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\ConstructionPlanService;
use App\Services\SupplierProductService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierActivationTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'supplier', string $status = 'approved'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => $status]);
    }

    private function product(User $supplier, array $attributes = []): SupplierProduct
    {
        $product = $supplier->supplierProducts()->create(array_merge([
            'name' => 'Cement 40kg', 'category' => 'Cement', 'description' => '40kg specification',
            'unit' => 'bag', 'price' => 280, 'stock' => 10, 'is_active' => false,
        ], $attributes));
        // Reservations are intentionally not mass assignable through supplier input.
        if (array_key_exists('reserved', $attributes)) {
            $product->forceFill(['reserved' => $attributes['reserved']])->save();
        }

        return $product->refresh();
    }

    private function unchangedExceptActivation(SupplierProduct $product, array $before): void
    {
        $after = $product->fresh()->getAttributes();
        unset($before['is_active'], $before['updated_at'], $after['is_active'], $after['updated_at']);
        $this->assertEquals($before, $after);
    }

    public function test_bulk_activation_is_owner_scoped_and_skips_ineligible_and_already_active_rows(): void
    {
        $supplier = $this->user();
        $eligible = $this->product($supplier);
        $active = $this->product($supplier, ['is_active' => true]);
        $zero = $this->product($supplier, ['stock' => 0]);
        $reserved = $this->product($supplier, ['reserved' => 10]);
        $invalid = $this->product($supplier, ['price' => 0]);
        $unknown = $this->product($supplier, ['description' => 'Stock availability is unconfirmed. Zero recorded stock is a system placeholder; verify stock before publishing.']);
        $other = $this->product($this->user());
        $all = collect([$eligible, $active, $zero, $reserved, $invalid, $unknown, $other]);
        $before = $all->mapWithKeys(fn ($p) => [$p->id => $p->getAttributes()]);
        Sanctum::actingAs($supplier);
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true])
            ->assertOk()->assertJsonPath('total', 6)->assertJsonPath('updated', 1)
            ->assertJsonPath('skipped', 5)->assertJsonPath('failed', 0)
            ->assertJsonPath('skipped_reasons.already_active', 1)
            ->assertJsonPath('skipped_reasons.out_of_stock', 2)
            ->assertJsonPath('skipped_reasons.invalid_price', 1)
            ->assertJsonPath('skipped_reasons.unconfirmed_stock', 1)->assertJsonCount(6, 'products');
        $this->assertTrue($eligible->fresh()->is_active);
        foreach ([$zero, $reserved, $invalid, $unknown, $other] as $p) {
            $this->assertFalse($p->fresh()->is_active);
        }
        foreach ($all as $p) {
            $this->unchangedExceptActivation($p, $before[$p->id]);
        }
        $this->assertEquals($before[$other->id], $other->fresh()->getAttributes());
        $this->assertEquals($before[$active->id], $active->fresh()->getAttributes());
        // A repeated submission does not create another update or touch already-active rows.
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true])
            ->assertOk()->assertJsonPath('updated', 0)->assertJsonPath('skipped', 6);
        $this->assertDatabaseCount('supplier_products', 7);
    }

    public function test_bulk_deactivation_preserves_every_record_and_other_supplier_stock_and_activation(): void
    {
        $supplier = $this->user();
        $first = $this->product($supplier, ['is_active' => true]);
        $zero = $this->product($supplier, ['is_active' => true, 'stock' => 0]);
        $inactive = $this->product($supplier);
        $other = $this->product($this->user(), ['is_active' => true]);
        $before = collect([$first, $zero, $inactive, $other])->mapWithKeys(fn ($p) => [$p->id => $p->getAttributes()]);
        Sanctum::actingAs($supplier);
        $this->patchJson('/api/supplier-products/activation', ['is_active' => false])
            ->assertOk()->assertJsonPath('updated', 2)->assertJsonPath('skipped', 1)->assertJsonPath('failed', 0);
        foreach ([$first, $zero, $inactive] as $p) {
            $this->assertFalse($p->fresh()->is_active);
            $this->unchangedExceptActivation($p, $before[$p->id]);
        }
        $this->assertEquals($before[$other->id], $other->fresh()->getAttributes());
        $this->assertDatabaseCount('supplier_products', 4);
    }

    public function test_bulk_endpoint_rejects_guest_wrong_roles_unapproved_accounts_and_scope_injection(): void
    {
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true])->assertUnauthorized();
        foreach (['homeowner', 'worker', 'contractor'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->patchJson('/api/supplier-products/activation', ['is_active' => true])->assertForbidden();
        }
        foreach (['pending', 'rejected', 'disabled', 'banned'] as $status) {
            $supplier = $this->user(status: $status);
            $p = $this->product($supplier);
            Sanctum::actingAs($supplier);
            $this->patchJson('/api/supplier-products/activation', ['is_active' => true])->assertForbidden();
            $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => true])->assertForbidden();
            $this->assertFalse($p->fresh()->is_active);
        }
        Sanctum::actingAs($this->user());
        $this->patchJson('/api/supplier-products/activation', [])->assertUnprocessable();
        $this->patchJson('/api/supplier-products/activation', ['is_active' => 'anything'])->assertUnprocessable();
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true, 'supplier_id' => 1])->assertUnprocessable();
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true, 'product_ids' => [1]])->assertUnprocessable();
    }

    public function test_individual_actions_only_change_the_selected_owned_product(): void
    {
        $supplier = $this->user();
        $target = $this->product($supplier);
        $untouched = $this->product($supplier, ['is_active' => true]);
        $other = $this->product($this->user());
        $before = $target->getAttributes();
        Sanctum::actingAs($supplier);
        $this->patchJson("/api/supplier-products/{$target->id}", ['is_active' => true])->assertOk()->assertJsonPath('is_active', true);
        $this->patchJson("/api/supplier-products/{$target->id}", ['is_active' => false])->assertOk()->assertJsonPath('is_active', false);
        $this->assertTrue($untouched->fresh()->is_active);
        $this->assertFalse($other->fresh()->is_active);
        $this->patchJson("/api/supplier-products/{$other->id}", ['is_active' => true])->assertUnprocessable();
        $this->unchangedExceptActivation($target, $before);
    }

    public function test_individual_activation_rechecks_current_price_stock_reservations_and_confirmation(): void
    {
        $supplier = $this->user();
        Sanctum::actingAs($supplier);
        foreach ([['stock' => 0], ['stock' => 10, 'reserved' => 10], ['price' => 0], ['description' => 'STOCK AVAILABILITY IS UNCONFIRMED.']] as $attributes) {
            $p = $this->product($supplier, $attributes);
            $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => true])->assertUnprocessable();
            $this->assertFalse($p->fresh()->is_active);
        }
        $p = $this->product($supplier);
        $p->update(['stock' => 0]); // The displayed count can be stale; the action rechecks the database.
        $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => true])->assertUnprocessable();
    }

    public function test_stock_updates_do_not_reactivate_manually_hidden_products_and_zero_stock_is_never_supply(): void
    {
        $supplier = $this->user();
        $p = $this->product($supplier);
        Sanctum::actingAs($supplier);
        $this->patchJson("/api/supplier-products/{$p->id}", ['stock' => 50])->assertOk()->assertJsonPath('is_active', false);
        $review = $this->getJson('/api/supplier-products/stock-confirmation')->assertOk()->json('review_token');
        $this->patchJson('/api/supplier-products/stock-confirmation', ['confirmed' => true, 'review_token' => $review])->assertOk();
        $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => true])->assertOk();
        $this->patchJson("/api/supplier-products/{$p->id}", ['stock' => 0])->assertOk()->assertJsonPath('stock_status', 'out_of_stock');
        $this->assertFalse(SupplierProduct::query()->availableForSupply()->whereKey($p->id)->exists());
        $this->assertSame('', app(SupplierProductService::class)->pricingContextForPrompt());
    }

    public function test_ai_and_catalog_use_valid_confirmed_listings_and_keep_historical_plan_unchanged(): void
    {
        $supplier = $this->user();
        $p = $this->product($supplier);
        $unknown = $this->product($supplier, ['is_active' => true, 'description' => 'Stock availability is unconfirmed.']);
        $invalid = $this->product($supplier, ['is_active' => true, 'price' => 0]);
        $zero = $this->product($supplier, ['is_active' => true, 'stock' => 0]);
        $owner = $this->user('homeowner');
        $project = $owner->projects()->create(['title' => 'Saved project', 'status' => 'active', 'started_at' => now()->toDateString(),
            'approved_plan' => ['materials' => [['material' => 'Historic cement', 'unitPrice' => 123]]], 'total_estimate' => 123]);
        $saved = $project->refresh()->getAttributes();
        Sanctum::actingAs($supplier);
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true])->assertOk()->assertJsonPath('updated', 1);
        Sanctum::actingAs($owner);
        $this->getJson('/api/ai/supplier-options')->assertOk()->assertJsonPath('0.suppliers.0.itemCount', 1);
        foreach ([$unknown, $invalid] as $hidden) {
            $this->getJson("/api/materials/{$hidden->id}")->assertNotFound();
        }
        $this->getJson("/api/materials/{$zero->id}")->assertOk()->assertJsonPath('stock_status', 'out_of_stock');
        $service = app(ConstructionPlanService::class);
        $plan = $service->applySupplierData(['materials' => [['material' => 'cement', 'qty' => 2, 'unit' => 'wrong', 'unitPrice' => 1, 'supplierProductId' => $p->id]]], $service->normalizeSelections([]));
        $this->assertSame(280, $plan['materials'][0]['unitPrice']);
        $this->assertSame('bag', $plan['materials'][0]['unit']);
        Sanctum::actingAs($supplier);
        $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => false])->assertOk();
        $this->assertSame('', app(SupplierProductService::class)->pricingContextForPrompt());
        $this->assertEquals($saved, $project->fresh()->getAttributes());
    }

    public function test_a_failure_during_bulk_update_rolls_back_the_whole_operation(): void
    {
        $supplier = $this->user();
        $first = $this->product($supplier);
        $second = $this->product($supplier);
        $dispatcher = SupplierProduct::getEventDispatcher();
        SupplierProduct::setEventDispatcher(clone $dispatcher);
        try {
            SupplierProduct::updating(function ($p) use ($second) {
                if ($p->id === $second->id) {
                    throw new \RuntimeException('Simulated write failure');
                }
            });
            try {
                app(SupplierProductService::class)->bulkActivation($supplier, true);
                $this->fail('Expected transactional failure');
            } catch (\RuntimeException $e) {
                $this->assertSame('Simulated write failure', $e->getMessage());
            }
            $this->assertFalse($first->fresh()->is_active);
            $this->assertFalse($second->fresh()->is_active);
        } finally {
            SupplierProduct::setEventDispatcher($dispatcher);
        }
    }

    public function test_supplier_summary_counts_only_valid_confirmed_available_listings_as_in_stock(): void
    {
        $supplier = $this->user();
        $this->product($supplier, ['is_active' => true]);
        $this->product($supplier, ['is_active' => true, 'description' => 'Stock availability is unconfirmed.']);
        $this->product($supplier, ['is_active' => true, 'price' => 0]);
        $this->product($supplier, ['is_active' => true, 'stock' => 0]);
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-profile')->assertOk()
            ->assertJsonPath('listings.total', 4)->assertJsonPath('listings.active', 4)->assertJsonPath('listings.inStock', 1);
    }
}
