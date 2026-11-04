<?php

namespace Tests\Feature;

use App\Models\SupplierProduct;
use App\Models\User;
use Database\Seeders\SupplierSheetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupplierSheetSeederTest extends TestCase
{
    use RefreshDatabase;

    private function supplier(string $name, string $email): User
    {
        return User::factory()->create([
            'role' => 'supplier', 'approval_status' => 'approved', 'name' => $name, 'email' => $email, 'business_name' => $name,
        ]);
    }

    private function tripleR(): User
    {
        return User::query()->where('email', 'trippler@panday.test')->firstOrFail();
    }

    public function test_it_creates_an_approved_tripple_r_supplier(): void
    {
        $this->seed(SupplierSheetSeeder::class);

        $tripleR = $this->tripleR();
        $this->assertSame('supplier', $tripleR->role);
        $this->assertSame('approved', $tripleR->approval_status);
        $this->assertSame('Tripple R', $tripleR->business_name);
        $this->assertSame('San Fabian', $tripleR->supplierProfile->location);
    }

    public function test_a_location_tripple_r_has_since_changed_is_not_reset_on_a_rerun(): void
    {
        $this->seed(SupplierSheetSeeder::class);
        $this->tripleR()->supplierProfile()->update(['location' => 'Dagupan City']);

        $this->seed(SupplierSheetSeeder::class);

        $this->assertSame('Dagupan City', $this->tripleR()->supplierProfile()->value('location'));
    }

    public function test_tripple_r_lists_every_material_with_the_sheets_prices_and_hides_the_blanks(): void
    {
        $this->seed(SupplierSheetSeeder::class);
        $listings = $this->tripleR()->supplierProducts()->get()->keyBy('name');

        // 91 materials on the sheet (item 92 is a blank "Other" line).
        $this->assertCount(91, $listings);

        $this->assertSame(215, $listings['Portland Cement Type I (40kg)']->price);
        $this->assertSame(1900, $listings['Washed Sand']->price);
        $this->assertSame(250, $listings['Steel Angle Bar']->price);
        $this->assertSame(1000, $listings['Door Jamb']->price);
        $this->assertTrue($listings['Door Jamb']->is_active);
        $this->assertGreaterThan(0, $listings['Door Jamb']->stock);

        // Left blank on the sheet: on file, but not buyable until Tripple R prices it.
        $this->assertFalse($listings['Interior Door']->is_active);
        $this->assertSame(0, $listings['Interior Door']->price);
        $this->assertSame(0, $listings['Interior Door']->stock);
        $this->assertFalse($listings['Wall Tile']->is_active);
    }

    public function test_a_blank_material_never_reaches_the_buyer_catalog_from_tripple_r(): void
    {
        $this->seed(SupplierSheetSeeder::class);

        $this->assertSame(0, SupplierProduct::query()->listed()->where('supplier_id', $this->tripleR()->id)->where('price', 0)->count());
        $this->assertSame(0, SupplierProduct::query()->listed()->where('supplier_id', $this->tripleR()->id)->where('name', 'Interior Door')->count());
    }

    public function test_every_existing_supplier_gets_all_the_materials_priced_and_in_stock(): void
    {
        $first = $this->supplier('Shop One', 'one@example.test');
        $second = $this->supplier('Shop Two', 'two@example.test');
        $this->seed(SupplierSheetSeeder::class);

        $names = $this->tripleR()->supplierProducts()->pluck('name')->sort()->values()->all();

        foreach ([$first, $second] as $supplier) {
            $listings = $supplier->supplierProducts()->get();
            $this->assertSame($names, $listings->pluck('name')->sort()->values()->all());
            $this->assertSame(0, $listings->where('price', '<=', 0)->count());
            $this->assertSame(0, $listings->where('is_active', false)->count());
            $this->assertSame(0, $listings->where('stock', '<=', 0)->count());
        }

        // The materials Tripple R left blank are priced by the others.
        $this->assertGreaterThan(0, $first->supplierProducts()->where('name', 'Interior Door')->value('price'));
    }

    public function test_the_other_suppliers_prices_differ_from_tripple_rs_and_from_each_other(): void
    {
        $first = $this->supplier('Shop One', 'one@example.test');
        $second = $this->supplier('Shop Two', 'two@example.test');
        $this->seed(SupplierSheetSeeder::class);

        $sheet = $this->tripleR()->supplierProducts()->where('is_active', true)->pluck('price', 'name');

        foreach ([$first, $second] as $supplier) {
            $theirs = $supplier->supplierProducts()->pluck('price', 'name');
            foreach ($sheet as $name => $price) {
                $this->assertNotSame($price, $theirs[$name], "{$supplier->name} should not charge Tripple R's price for {$name}");
            }
        }

        $firstPrices = $first->supplierProducts()->pluck('price', 'name');
        $secondPrices = $second->supplierProducts()->pluck('price', 'name');
        $this->assertNotSame($firstPrices->all(), $secondPrices->all());
    }

    public function test_listings_a_supplier_already_has_are_left_untouched_not_duplicated(): void
    {
        $shop = $this->supplier('Shop One', 'one@example.test');
        $shop->supplierProducts()->create([
            'name' => 'Portland Cement Type I (40kg)', 'category' => 'Cement', 'unit' => 'bag', 'price' => 265, 'stock' => 7, 'description' => 'mine',
        ]);
        $this->seed(SupplierSheetSeeder::class);

        $cement = $shop->supplierProducts()->where('name', 'Portland Cement Type I (40kg)')->get();
        $this->assertCount(1, $cement);
        $this->assertSame(265, $cement->first()->price);
        $this->assertSame(7, $cement->first()->stock);
        $this->assertSame('mine', $cement->first()->description);
    }

    public function test_running_it_twice_changes_nothing(): void
    {
        $shop = $this->supplier('Shop One', 'one@example.test');
        $this->seed(SupplierSheetSeeder::class);
        $before = SupplierProduct::query()->orderBy('id')->get(['supplier_id', 'name', 'price', 'stock', 'is_active'])->toArray();

        $this->seed(SupplierSheetSeeder::class);
        $after = SupplierProduct::query()->orderBy('id')->get(['supplier_id', 'name', 'price', 'stock', 'is_active'])->toArray();

        $this->assertSame($before, $after);
        $this->assertSame(91, $shop->supplierProducts()->count());
    }

    public function test_a_blank_that_tripple_r_has_since_priced_is_not_reset_on_a_rerun(): void
    {
        $this->seed(SupplierSheetSeeder::class);
        $this->tripleR()->supplierProducts()->where('name', 'Interior Door')->update(['price' => 3100, 'stock' => 4, 'is_active' => true]);

        $this->seed(SupplierSheetSeeder::class);

        $door = $this->tripleR()->supplierProducts()->where('name', 'Interior Door')->first();
        $this->assertSame(3100, $door->price);
        $this->assertTrue($door->is_active);
    }

    public function test_every_listing_uses_a_valid_category(): void
    {
        $this->seed(SupplierSheetSeeder::class);

        $this->assertSame(
            [],
            SupplierProduct::query()->whereNotIn('category', SupplierProduct::CATEGORIES)->pluck('name')->all()
        );
    }
}
