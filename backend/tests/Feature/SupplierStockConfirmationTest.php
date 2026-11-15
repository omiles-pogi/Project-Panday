<?php

namespace Tests\Feature;

use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\StockService;
use App\Services\SupplierProductService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierStockConfirmationTest extends TestCase
{
    use RefreshDatabase;

    private function supplier(): User
    {
        return User::factory()->create(['role' => 'supplier', 'approval_status' => 'approved']);
    }

    private function product(User $supplier, array $values = []): SupplierProduct
    {
        return $supplier->supplierProducts()->create(array_merge(['name' => 'PVC pipe', 'category' => 'Plumbing',
            'description' => "Specification: 1/2 inch\nStock availability is unconfirmed. Original source category and reference retained.",
            'unit' => 'length', 'price' => 70, 'stock' => 10, 'is_active' => false], $values))->refresh();
    }

    private function review(): string
    {
        return $this->getJson('/api/supplier-products/stock-confirmation')->assertOk()->json('review_token');
    }

    private function confirm(string $token): TestResponse
    {
        return $this->patchJson('/api/supplier-products/stock-confirmation', ['confirmed' => true, 'review_token' => $token]);
    }

    public function test_review_is_read_only_and_confirmation_records_supplier_quantity_and_time_without_activation(): void
    {
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        $other = $this->product($this->supplier());
        $before = $p->getAttributes();
        $otherBefore = $other->getAttributes();
        Sanctum::actingAs($supplier);
        $response = $this->getJson('/api/supplier-products/stock-confirmation')->assertOk()
            ->assertJsonPath('count', 1)->assertJsonPath('products.0.id', $p->id)
            ->assertJsonPath('products.0.stock', 10)->assertJsonPath('products.0.unit', 'length');
        $this->assertEquals($before, $p->fresh()->getAttributes());
        $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => true])->assertUnprocessable();
        $this->patchJson('/api/supplier-products/stock-confirmation', ['confirmed' => false, 'review_token' => $response->json('review_token')])->assertUnprocessable();
        $this->assertNull($p->fresh()->stock_is_confirmed);
        $this->confirm($response->json('review_token'))->assertOk()->assertJsonPath('updated', 1);
        $after = $p->fresh();
        $this->assertTrue($after->stock_confirmed);
        $this->assertTrue($after->stock_is_confirmed);
        $this->assertSame($supplier->id, $after->stock_confirmed_by);
        $this->assertSame(10, $after->stock_confirmed_quantity);
        $this->assertNotNull($after->stock_confirmed_at);
        $this->assertFalse($after->is_active);
        foreach (['stock', 'reserved', 'price', 'name', 'category', 'description', 'unit', 'min_order', 'supplier_id', 'is_active'] as $field) {
            $this->assertSame($before[$field], $after->getAttributes()[$field]);
        }
        $this->assertEquals($otherBefore, $other->fresh()->getAttributes());
        $this->confirm($response->json('review_token'))->assertOk()->assertJsonPath('updated', 0)->assertJsonPath('skipped', 1);
    }

    public function test_bulk_confirmation_then_bulk_and_individual_activation_use_structured_status_and_preserve_notes(): void
    {
        $supplier = $this->supplier();
        $first = $this->product($supplier);
        $zero = $this->product($supplier, ['stock' => 0]);
        $note = $first->description;
        Sanctum::actingAs($supplier);
        $this->confirm($this->review())->assertOk()->assertJsonPath('updated', 2);
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true])->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('skipped', 1);
        $this->assertTrue($first->fresh()->is_active);
        $this->assertFalse($zero->fresh()->is_active);
        $this->assertSame($note, $first->fresh()->description);
        $this->assertTrue(SupplierProduct::query()->availableForSupply()->whereKey($first->id)->exists());
        $this->assertStringContainsString('PVC pipe', app(SupplierProductService::class)->pricingContextForPrompt());
        $this->patchJson('/api/supplier-products/activation', ['is_active' => false])->assertOk()->assertJsonPath('updated', 1);
        $this->patchJson("/api/supplier-products/{$first->id}", ['is_active' => true])->assertOk();
        $this->patchJson("/api/supplier-products/{$first->id}", ['is_active' => false])->assertOk();
        $this->assertSame('', app(SupplierProductService::class)->pricingContextForPrompt());
    }

    public function test_stale_reviews_never_confirm_changed_stock_price_description_activation_or_added_reservations(): void
    {
        foreach (['stock' => 11, 'price' => 71, 'description' => 'Changed description', 'is_active' => true, 'reserved' => 1] as $field => $changed) {
            $supplier = $this->supplier();
            $p = $this->product($supplier);
            Sanctum::actingAs($supplier);
            $token = $this->review();
            $p->forceFill([$field => $changed])->save();
            $this->confirm($token)->assertUnprocessable();
            $this->assertNull($p->fresh()->stock_is_confirmed);
        }
    }

    public function test_review_is_owner_bound_tamper_proof_expiring_and_does_not_include_later_products(): void
    {
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        Sanctum::actingAs($supplier);
        $token = $this->review();
        $this->confirm('invalid')->assertUnprocessable();
        Sanctum::actingAs($this->supplier());
        $this->confirm($token)->assertUnprocessable();
        Sanctum::actingAs($supplier);
        $later = $this->product($supplier);
        $this->confirm($token)->assertOk()->assertJsonPath('updated', 1);
        $this->assertNull($later->fresh()->stock_is_confirmed);
        $newToken = $this->review();
        $this->travel(11)->minutes();
        $this->confirm($newToken)->assertUnprocessable();
        $this->assertNull($later->fresh()->stock_is_confirmed);
    }

    public function test_manual_quantity_changes_require_reverification_and_note_editing_cannot_bypass_it(): void
    {
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        Sanctum::actingAs($supplier);
        $this->patchJson("/api/supplier-products/{$p->id}", ['description' => 'Original category retained, edited prose'])->assertOk();
        $this->assertFalse($p->fresh()->stock_confirmed);
        $this->patchJson("/api/supplier-products/{$p->id}", ['is_active' => true])->assertUnprocessable();
        $this->confirm($this->review())->assertOk();
        $this->patchJson("/api/supplier-products/{$p->id}", ['stock' => 20])->assertOk()->assertJsonPath('stock_confirmed', false);
        $this->assertSame(10, $p->fresh()->stock_confirmed_quantity); // Last attestation remains auditable.
        $this->confirm($this->review())->assertOk();
        $this->assertSame(20, $p->fresh()->stock_confirmed_quantity);
        app(StockService::class)->reserve($p->id, 2);
        app(StockService::class)->deduct($p->id, 2);
        $this->assertTrue($p->fresh()->stock_confirmed);
        $this->assertSame(18, $p->fresh()->stock);
    }

    public function test_stock_attestation_fields_cannot_be_forged_in_normal_product_requests(): void
    {
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        Sanctum::actingAs($supplier);
        foreach (['stock_confirmed' => true, 'stock_is_confirmed' => true, 'stock_confirmed_at' => now()->toIso8601String(), 'stock_confirmed_by' => $supplier->id, 'stock_confirmed_quantity' => 10] as $field => $value) {
            $this->patchJson("/api/supplier-products/{$p->id}", [$field => $value])->assertUnprocessable();
        }
        $this->patchJson('/api/supplier-products/stock-confirmation', ['confirmed' => true, 'review_token' => $this->review(), 'supplier_id' => $supplier->id])->assertUnprocessable();
        $this->assertNull($p->fresh()->stock_is_confirmed);
    }

    public function test_confirmation_requires_approved_supplier_and_cannot_bypass_revocation_after_review(): void
    {
        $this->getJson('/api/supplier-products/stock-confirmation')->assertUnauthorized();
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        Sanctum::actingAs($supplier);
        $token = $this->review();
        $supplier->update(['approval_status' => 'rejected']);
        $this->confirm($token)->assertForbidden();
        $this->assertNull($p->fresh()->stock_is_confirmed);
        Sanctum::actingAs(User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']));
        $this->getJson('/api/supplier-products/stock-confirmation')->assertForbidden();
    }

    public function test_confirmation_failure_rolls_back_all_attestations(): void
    {
        $supplier = $this->supplier();
        $first = $this->product($supplier);
        $second = $this->product($supplier);
        Sanctum::actingAs($supplier);
        $token = $this->review();
        $dispatcher = SupplierProduct::getEventDispatcher();
        SupplierProduct::setEventDispatcher(clone $dispatcher);
        try {
            SupplierProduct::updating(function ($p) use ($second) {
                if ($p->id === $second->id) {
                    throw new \RuntimeException('Simulated confirmation failure');
                }
            });
            try {
                app(SupplierProductService::class)->confirmStock($supplier, $token);
                $this->fail('Expected transactional failure');
            } catch (\RuntimeException $e) {
                $this->assertSame('Simulated confirmation failure', $e->getMessage());
            }
            $this->assertNull($first->fresh()->stock_is_confirmed);
            $this->assertNull($second->fresh()->stock_is_confirmed);
            $this->assertFalse($first->fresh()->is_active);
            $this->assertFalse($second->fresh()->is_active);
        } finally {
            SupplierProduct::setEventDispatcher($dispatcher);
        }
    }

    public function test_additive_migration_preserves_legacy_records_and_does_not_attest_or_activate_them(): void
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->dropColumn(['stock_is_confirmed', 'stock_confirmed_at', 'stock_confirmed_by', 'stock_confirmed_quantity']);
        });
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        $other = $this->product($this->supplier(), ['description' => 'Existing manually entered material', 'is_active' => true]);
        $before = $p->getAttributes();
        $otherBefore = $other->getAttributes();
        $migration = require database_path('migrations/2026_11_14_030000_add_stock_confirmation_to_supplier_products_table.php');
        $migration->up();
        $this->assertEquals($before, array_intersect_key($p->fresh()->getAttributes(), $before));
        $this->assertEquals($otherBefore, array_intersect_key($other->fresh()->getAttributes(), $otherBefore));
        $this->assertNull($p->fresh()->stock_is_confirmed);
        $this->assertNull($p->fresh()->stock_confirmed_at);
        $this->assertNull($other->fresh()->stock_is_confirmed);
        $this->assertNull($other->fresh()->stock_confirmed_by);
        $this->assertFalse($p->fresh()->is_active);
        $this->assertFalse($p->fresh()->stock_confirmed);
        // Untouched other suppliers keep their pre-migration access policy; no attestation was invented.
        $this->assertTrue(SupplierProduct::query()->availableForSupply()->whereKey($other->id)->exists());
    }

    public function test_before_the_migration_reads_remain_available_and_confirmation_fails_closed(): void
    {
        $supplier = $this->supplier();
        $p = $this->product($supplier);
        Sanctum::actingAs($supplier);
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->dropColumn(['stock_is_confirmed', 'stock_confirmed_at', 'stock_confirmed_by', 'stock_confirmed_quantity']);
        });
        $this->getJson('/api/supplier-products')->assertOk()->assertJsonPath('0.stock_confirmed', false);
        $this->getJson('/api/supplier-products/stock-confirmation')->assertStatus(503);
        $this->patchJson('/api/supplier-products/activation', ['is_active' => true])->assertOk()->assertJsonPath('updated', 0);
        $this->assertFalse($p->fresh()->is_active);
        $this->assertSame(10, $p->fresh()->stock);
    }
}
