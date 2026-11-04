<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierProfileTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    private function supplier(): User
    {
        return $this->user('supplier', ['name' => 'Tess Tan', 'business_name' => 'Tan Hardware', 'license_number' => 'DTI-1234']);
    }

    public function test_a_supplier_with_no_profile_yet_sees_their_account_details_and_empty_shop_fields(): void
    {
        $supplier = $this->supplier();
        Sanctum::actingAs($supplier);

        $this->getJson('/api/supplier-profile')
            ->assertOk()
            ->assertJsonPath('name', 'Tess Tan')
            ->assertJsonPath('businessName', 'Tan Hardware')
            ->assertJsonPath('licenseNumber', 'DTI-1234')
            ->assertJsonPath('approvalStatus', 'approved')
            ->assertJsonPath('location', null)
            ->assertJsonPath('contactNumber', null)
            ->assertJsonPath('bio', null)
            ->assertJsonPath('listings', ['total' => 0, 'active' => 0, 'inStock' => 0]);
    }

    public function test_the_profile_counts_total_active_and_in_stock_listings(): void
    {
        $supplier = $this->supplier();
        $make = fn (string $name, array $o = []) => $supplier->supplierProducts()->create(array_merge(
            ['name' => $name, 'category' => 'Cement', 'unit' => 'bag', 'price' => 100, 'stock' => 10], $o
        ));
        $make('In Stock');
        $make('Sold Out', ['stock' => 0]);
        // `reserved` is only ever moved by StockService, so it isn't mass-assignable.
        $make('Fully Reserved', ['stock' => 5])->forceFill(['reserved' => 5])->save();
        $make('Hidden', ['is_active' => false]);
        Sanctum::actingAs($supplier);

        $this->getJson('/api/supplier-profile')
            ->assertJsonPath('listings', ['total' => 4, 'active' => 3, 'inStock' => 1]);
    }

    public function test_a_supplier_can_save_their_shop_details(): void
    {
        $supplier = $this->supplier();
        Sanctum::actingAs($supplier);

        $this->putJson('/api/supplier-profile', [
            'location' => 'San Fabian, Pangasinan',
            'contact_number' => '+63 912 345 6789',
            'bio' => 'Cement, steel and plumbing since 2005.',
        ])
            ->assertOk()
            ->assertJsonPath('location', 'San Fabian, Pangasinan')
            ->assertJsonPath('contactNumber', '+63 912 345 6789')
            ->assertJsonPath('bio', 'Cement, steel and plumbing since 2005.');

        $this->assertSame('San Fabian, Pangasinan', $supplier->fresh()->supplierProfile->location);
        $this->getJson('/api/supplier-profile')->assertJsonPath('location', 'San Fabian, Pangasinan');
    }

    public function test_saving_again_updates_the_same_profile_and_empty_fields_are_cleared(): void
    {
        $supplier = $this->supplier();
        Sanctum::actingAs($supplier);
        $this->putJson('/api/supplier-profile', ['location' => 'San Fabian', 'contact_number' => '09123456789', 'bio' => 'Hello'])->assertOk();

        $this->putJson('/api/supplier-profile', ['location' => 'Dagupan City', 'contact_number' => '', 'bio' => ''])
            ->assertOk()
            ->assertJsonPath('location', 'Dagupan City')
            ->assertJsonPath('contactNumber', null)
            ->assertJsonPath('bio', null);

        $this->assertDatabaseCount('supplier_profiles', 1);
    }

    public function test_the_verified_business_name_and_license_cannot_be_changed_from_the_profile(): void
    {
        $supplier = $this->supplier();
        Sanctum::actingAs($supplier);

        $this->putJson('/api/supplier-profile', [
            'location' => 'San Fabian', 'business_name' => 'Somebody Else Inc.', 'license_number' => 'FAKE-1', 'role' => 'admin',
        ])->assertOk()->assertJsonPath('businessName', 'Tan Hardware')->assertJsonPath('licenseNumber', 'DTI-1234');

        $fresh = $supplier->fresh();
        $this->assertSame('Tan Hardware', $fresh->business_name);
        $this->assertSame('DTI-1234', $fresh->license_number);
        $this->assertSame('supplier', $fresh->role);
    }

    public function test_the_contact_number_must_look_like_a_phone_number(): void
    {
        Sanctum::actingAs($this->supplier());

        $this->putJson('/api/supplier-profile', ['contact_number' => 'call me maybe'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('contact_number');
        $this->putJson('/api/supplier-profile', ['bio' => str_repeat('x', 1001)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('bio');
    }

    public function test_only_suppliers_have_a_supplier_profile(): void
    {
        foreach (['homeowner', 'contractor', 'worker'] as $role) {
            Sanctum::actingAs($this->user($role));

            $this->getJson('/api/supplier-profile')->assertForbidden();
            $this->putJson('/api/supplier-profile', ['location' => 'Anywhere'])->assertForbidden();
        }
    }

    public function test_a_supplier_only_ever_sees_and_edits_their_own_profile(): void
    {
        $mine = $this->supplier();
        $theirs = $this->user('supplier', ['name' => 'Other Shop']);
        $theirs->supplierProfile()->create(['location' => 'Elsewhere']);
        Sanctum::actingAs($mine);

        $this->getJson('/api/supplier-profile')->assertJsonPath('location', null);
        $this->putJson('/api/supplier-profile', ['location' => 'San Fabian'])->assertOk();

        $this->assertSame('Elsewhere', $theirs->fresh()->supplierProfile->location);
    }

    public function test_buyers_see_the_suppliers_location_and_contact_number_in_the_catalog(): void
    {
        $supplier = $this->supplier();
        $supplier->supplierProfile()->create(['location' => 'San Fabian', 'contact_number' => '09123456789', 'bio' => 'private to the profile page']);
        $product = $supplier->supplierProducts()->create(['name' => 'Portland Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 250, 'stock' => 10]);
        Sanctum::actingAs($this->user('homeowner'));

        $this->getJson('/api/materials')
            ->assertOk()
            ->assertJsonPath('0.supplier.supplier_profile.location', 'San Fabian')
            ->assertJsonPath('0.supplier.supplier_profile.contact_number', '09123456789');
        $this->getJson("/api/materials/{$product->id}")
            ->assertOk()
            ->assertJsonPath('supplier.supplier_profile.location', 'San Fabian');
    }

    public function test_a_supplier_without_a_profile_still_appears_in_the_catalog(): void
    {
        $supplier = $this->supplier();
        $supplier->supplierProducts()->create(['name' => 'Portland Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 250, 'stock' => 10]);
        Sanctum::actingAs($this->user('contractor'));

        $this->getJson('/api/materials')
            ->assertOk()
            ->assertJsonPath('0.supplier.business_name', 'Tan Hardware')
            ->assertJsonPath('0.supplier.supplier_profile', null);
    }
}
