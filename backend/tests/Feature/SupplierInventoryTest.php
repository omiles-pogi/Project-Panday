<?php

namespace Tests\Feature;

use App\Models\SupplierProduct;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierInventoryTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    /**
     * @return array<string, mixed>
     */
    private function materialPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Portland Cement Type I',
            'category' => 'Cement',
            'description' => '40kg bag, general purpose.',
            'unit' => 'bag',
            'price' => 280,
            'stock' => 120,
        ], $overrides);
    }

    private function product(User $supplier, array $overrides = []): SupplierProduct
    {
        return $supplier->supplierProducts()->create($this->materialPayload($overrides));
    }

    public function test_a_supplier_can_add_a_material_and_it_is_in_stock(): void
    {
        $supplier = $this->user('supplier');
        Sanctum::actingAs($supplier);

        $response = $this->postJson('/api/supplier-products', $this->materialPayload());

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Portland Cement Type I')
            ->assertJsonPath('description', '40kg bag, general purpose.')
            ->assertJsonPath('stock', 120)
            ->assertJsonPath('stock_status', 'in_stock')
            ->assertJsonPath('is_active', true);
        $this->assertDatabaseHas('supplier_products', ['supplier_id' => $supplier->id, 'name' => 'Portland Cement Type I']);
    }

    public function test_a_material_added_with_zero_stock_is_out_of_stock(): void
    {
        Sanctum::actingAs($this->user('supplier'));

        $this->postJson('/api/supplier-products', $this->materialPayload(['stock' => 0]))
            ->assertStatus(201)
            ->assertJsonPath('stock_status', 'out_of_stock');
    }

    public function test_updating_quantity_recomputes_stock_status(): void
    {
        $supplier = $this->user('supplier');
        $product = $this->product($supplier, ['stock' => 5]);
        Sanctum::actingAs($supplier);

        $this->patchJson("/api/supplier-products/{$product->id}", ['stock' => 0])
            ->assertStatus(200)
            ->assertJsonPath('stock', 0)
            ->assertJsonPath('stock_status', 'out_of_stock');

        $this->patchJson("/api/supplier-products/{$product->id}", ['stock' => 40])
            ->assertStatus(200)
            ->assertJsonPath('stock_status', 'in_stock');
    }

    public function test_a_supplier_can_edit_material_details(): void
    {
        $supplier = $this->user('supplier');
        $product = $this->product($supplier);
        Sanctum::actingAs($supplier);

        $this->patchJson("/api/supplier-products/{$product->id}", [
            'name' => 'Portland Cement Type IP',
            'category' => 'Cement',
            'description' => 'Pozzolan blend.',
            'unit' => 'bag',
            'price' => 265,
        ])->assertStatus(200)
            ->assertJsonPath('name', 'Portland Cement Type IP')
            ->assertJsonPath('price', 265)
            ->assertJsonPath('description', 'Pozzolan blend.');
    }

    public function test_negative_stock_and_unknown_categories_are_rejected(): void
    {
        $supplier = $this->user('supplier');
        $product = $this->product($supplier);
        Sanctum::actingAs($supplier);

        $this->patchJson("/api/supplier-products/{$product->id}", ['stock' => -1])->assertStatus(422);
        $this->postJson('/api/supplier-products', $this->materialPayload(['stock' => -5]))->assertStatus(422);
        $this->postJson('/api/supplier-products', $this->materialPayload(['category' => 'Spaceships']))->assertStatus(422);
        $this->assertSame(120, $product->fresh()->stock);
    }

    public function test_a_supplier_cannot_modify_or_delete_another_suppliers_material(): void
    {
        $owner = $this->user('supplier');
        $product = $this->product($owner);
        Sanctum::actingAs($this->user('supplier'));

        $this->patchJson("/api/supplier-products/{$product->id}", ['stock' => 0])->assertStatus(422);
        $this->deleteJson("/api/supplier-products/{$product->id}")->assertStatus(422);
        $this->assertSame(120, $product->fresh()->stock);
    }

    public function test_homeowners_and_contractors_cannot_modify_inventory(): void
    {
        $product = $this->product($this->user('supplier'));

        foreach (['homeowner', 'contractor'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->postJson('/api/supplier-products', $this->materialPayload())->assertStatus(403);
            $this->patchJson("/api/supplier-products/{$product->id}", ['stock' => 0])->assertStatus(403);
            $this->deleteJson("/api/supplier-products/{$product->id}")->assertStatus(403);
        }

        $this->assertSame(120, $product->fresh()->stock);
    }

    public function test_a_supplier_can_deactivate_and_delete_their_material(): void
    {
        $supplier = $this->user('supplier');
        $product = $this->product($supplier);
        Sanctum::actingAs($supplier);

        $this->patchJson("/api/supplier-products/{$product->id}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('is_active', false);

        $this->deleteJson("/api/supplier-products/{$product->id}")->assertStatus(204);
        $this->assertDatabaseMissing('supplier_products', ['id' => $product->id]);
    }

    public function test_homeowners_and_contractors_can_browse_the_catalog_with_supplier_info(): void
    {
        $supplier = $this->user('supplier', ['name' => 'Ana Reyes', 'business_name' => 'Reyes Hardware']);
        $this->product($supplier, ['name' => 'Sand (Washed)', 'category' => 'Sand', 'stock' => 0]);
        $this->product($supplier, ['name' => 'Deformed Bar 10mm', 'category' => 'Steel']);

        foreach (['homeowner', 'contractor'] as $role) {
            Sanctum::actingAs($this->user($role));
            $response = $this->getJson('/api/materials');

            // In-stock first, out-of-stock still listed.
            $response->assertStatus(200)
                ->assertJsonCount(2)
                ->assertJsonPath('0.name', 'Deformed Bar 10mm')
                ->assertJsonPath('0.stock_status', 'in_stock')
                ->assertJsonPath('0.supplier.business_name', 'Reyes Hardware')
                ->assertJsonPath('1.name', 'Sand (Washed)')
                ->assertJsonPath('1.stock_status', 'out_of_stock');
        }
    }

    public function test_the_catalog_reflects_a_stock_update_immediately(): void
    {
        $supplier = $this->user('supplier');
        $product = $this->product($supplier, ['stock' => 3]);

        Sanctum::actingAs($supplier);
        $this->patchJson("/api/supplier-products/{$product->id}", ['stock' => 0])->assertStatus(200);

        Sanctum::actingAs($this->user('homeowner'));
        $this->getJson("/api/materials/{$product->id}")
            ->assertStatus(200)
            ->assertJsonPath('stock_status', 'out_of_stock');
    }

    public function test_catalog_search_and_filters(): void
    {
        $supplier = $this->user('supplier');
        $this->product($supplier, ['name' => 'Portland Cement', 'category' => 'Cement', 'stock' => 10]);
        $this->product($supplier, ['name' => 'Masonry Cement', 'category' => 'Cement', 'stock' => 0]);
        $this->product($supplier, ['name' => 'GI Wire', 'category' => 'Hardware', 'stock' => 4]);
        Sanctum::actingAs($this->user('homeowner'));

        $this->getJson('/api/materials?search=cement')->assertStatus(200)->assertJsonCount(2);
        $this->getJson('/api/materials?category=Hardware')->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.name', 'GI Wire');
        $this->getJson('/api/materials?stock=out_of_stock')->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.name', 'Masonry Cement');
        $this->getJson('/api/materials?search=cement&stock=in_stock')->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.name', 'Portland Cement');
        // LIKE wildcards in the search term are matched literally, not as wildcards.
        $this->getJson('/api/materials?search=%25')->assertStatus(200)->assertJsonCount(0);
        $this->getJson('/api/materials?stock=bogus')->assertStatus(422);
    }

    public function test_deactivated_listings_and_unapproved_suppliers_are_hidden_from_the_catalog(): void
    {
        $approved = $this->user('supplier');
        $pending = $this->user('supplier', ['approval_status' => 'pending']);
        $hidden = $this->product($approved, ['name' => 'Hidden', 'is_active' => false]);
        $pendingProduct = $this->product($pending, ['name' => 'Pending supplier item']);
        $this->product($approved, ['name' => 'Visible']);
        Sanctum::actingAs($this->user('contractor'));

        $this->getJson('/api/materials')->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.name', 'Visible');
        $this->getJson("/api/materials/{$hidden->id}")->assertStatus(404);
        $this->getJson("/api/materials/{$pendingProduct->id}")->assertStatus(404);
    }

    public function test_workers_and_suppliers_cannot_use_the_buyer_catalog(): void
    {
        foreach (['worker', 'supplier'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/materials')->assertStatus(403);
        }
    }

    public function test_a_supplier_only_lists_their_own_inventory(): void
    {
        $supplier = $this->user('supplier');
        $this->product($supplier, ['name' => 'Mine']);
        $this->product($this->user('supplier'), ['name' => 'Theirs']);
        Sanctum::actingAs($supplier);

        $this->getJson('/api/supplier-products')->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.name', 'Mine');
    }
}
