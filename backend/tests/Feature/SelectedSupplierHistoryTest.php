<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SelectedSupplierHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'supplier'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner, array $selections, array $materials = [], string $status = 'completed'): Project
    {
        return Project::create(['user_id' => $owner->id, 'title' => 'Saved homeowner project', 'status' => $status,
            'budget' => 900000, 'total_estimate' => 800000, 'timeline_value' => 6, 'timeline_unit' => 'months',
            'started_at' => '2026-01-01', 'completion_confirmed_at' => $status === 'completed' ? '2026-11-14 15:00:00' : null,
            'approved_plan' => ['floors' => 2, 'description' => 'Private owner description', 'supplierSelections' => $selections, 'materials' => $materials],
            'ai_materials' => $materials]);
    }

    private function material(string $category, string $name, array $changes = []): array
    {
        return array_replace(['material' => $name, 'category' => $category, 'qty' => 2.5, 'unit' => 'bag', 'unitPrice' => 100, 'supplierProductId' => 0], $changes);
    }

    public function test_completed_selections_work_without_orders_and_scope_each_suppliers_saved_estimates(): void
    {
        $a = $this->user();
        $b = $this->user();
        $owner = $this->user('homeowner');
        $project = $this->project($owner, ['Construction Materials' => $a->id, 'Finishing Works' => $a->id, 'Electrical and Plumbing' => $b->id], [
            $this->material('Construction Materials', 'Saved cement'), $this->material('Finishing Works', 'Saved paint'),
            $this->material('Electrical and Plumbing', 'Other supplier private wire', ['unitPrice' => 9999]),
        ]);
        DB::table('projects')->where('id', $project->id)->update(['is_hidden_from_dashboard' => true]);
        $before = $project->fresh()->getRawOriginal();
        Sanctum::actingAs($a);
        $this->getJson('/api/supplier-history')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $project->id)
            ->assertJsonPath('0.lineCount', 2)->assertJsonPath('0.totalAmount', 500)->assertJsonCount(2, '0.selectedCategories');
        $detail = $this->getJson("/api/supplier-history/{$project->id}")->assertOk()->assertJsonCount(2, 'items')
            ->assertJsonPath('associationType', 'selected_estimate')->assertJsonPath('items.0.quantity', 2.5)
            ->assertJsonPath('items.0.unitPrice', 100)->assertJsonPath('items.0.lineTotal', 250)
            ->assertJsonPath('items.0.priceSource', 'saved_estimate');
        $this->assertStringNotContainsString('Other supplier private wire', $detail->getContent());
        $this->assertStringNotContainsString('Private owner description', $detail->getContent());
        $this->assertArrayNotHasKey('approvedPlan', $detail->json());
        Sanctum::actingAs($b);
        $this->getJson("/api/supplier-history/{$project->id}")->assertOk()->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.name', 'Other supplier private wire')->assertJsonPath('totalAmount', 24997.5);
        Sanctum::actingAs($owner);
        $this->getJson('/api/project-history')->assertOk()->assertJsonPath('0.id', $project->id);
        $this->assertSame($before, $project->fresh()->getRawOriginal());
        $this->assertDatabaseCount('material_requests', 0);
        $this->assertDatabaseCount('supplier_fulfillments', 0);
    }

    public function test_ongoing_hidden_incomplete_and_price_reference_only_projects_do_not_qualify(): void
    {
        $supplier = $this->user();
        $owner = $this->user('homeowner');
        foreach (['active', 'not_started', 'pending_confirmation'] as $status) {
            $p = $this->project($owner, ['Construction Materials' => $supplier->id], [], $status);
            DB::table('projects')->where('id', $p->id)->update(['is_hidden_from_dashboard' => true]);
        }
        $product = $supplier->supplierProducts()->create(['name' => 'Supplier listing', 'category' => 'Cement', 'unit' => 'bag', 'price' => 900, 'stock' => 10]);
        $p = $this->project($owner, ['Construction Materials' => null], [$this->material('Construction Materials', 'Price reference only', ['supplierProductId' => $product->id, 'supplierId' => $supplier->id])]);
        $this->project($this->user('contractor'), ['Construction Materials' => $supplier->id]);
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-history')->assertOk()->assertExactJson([]);
        $this->getJson("/api/supplier-history/{$p->id}")->assertNotFound();
    }

    public function test_selected_supplier_with_no_materials_is_visible_without_inventing_a_zero_cost_or_other_suppliers_lines(): void
    {
        $a = $this->user();
        $b = $this->user();
        $p = $this->project($this->user('homeowner'), ['Finishing Works' => $a->id, 'Electrical and Plumbing' => $b->id], [$this->material('Finishing Works', 'Private paint')]);
        Sanctum::actingAs($b);
        $this->getJson('/api/supplier-history')->assertOk()->assertJsonCount(1)->assertJsonPath('0.totalAmount', null);
        $this->getJson("/api/supplier-history/{$p->id}")->assertOk()->assertJsonCount(0, 'items')->assertJsonPath('lineCount', 0);
        Sanctum::actingAs($this->user());
        $this->getJson("/api/supplier-history/{$p->id}")->assertNotFound();
    }

    public function test_saved_listing_prices_survive_inventory_edits_retirement_and_deletion_without_summing_twice(): void
    {
        $supplier = $this->user();
        $product = $supplier->supplierProducts()->create(['name' => 'Live listing', 'category' => 'Cement', 'unit' => 'bag', 'price' => 900, 'stock' => 10]);
        $line = $this->material('Construction Materials', 'Historical cement', ['supplierProductId' => $product->id, 'supplierId' => $supplier->id, 'unitPrice' => 200]);
        $p = $this->project($this->user('homeowner'), ['Construction Materials' => (string) $supplier->id, 'Finishing Works' => $supplier->id], [$line, $line]);
        $product->update(['price' => 99999, 'stock' => 0, 'is_active' => false]);
        $product->delete();
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-history')->assertOk()->assertJsonCount(1)->assertJsonPath('0.totalAmount', 1000);
        $r = $this->getJson("/api/supplier-history/{$p->id}")->assertOk()->assertJsonCount(2, 'items')
            ->assertJsonPath('items.0.unitPrice', 200)->assertJsonPath('items.0.priceSource', 'supplier_listing');
        $this->assertNotSame($r->json('items.0.id'), $r->json('items.1.id'));
    }

    public function test_another_suppliers_quote_is_not_exposed_by_a_new_category_preference(): void
    {
        $selected = $this->user();
        $quoted = $this->user();
        $product = $quoted->supplierProducts()->create(['name' => 'Private listing', 'category' => 'Cement', 'unit' => 'bag', 'price' => 900, 'stock' => 10]);
        $p = $this->project($this->user('homeowner'), ['Construction Materials' => $selected->id], [$this->material('Construction Materials', 'Other supplier private quote', ['supplierProductId' => $product->id])]);
        Sanctum::actingAs($selected);
        $r = $this->getJson("/api/supplier-history/{$p->id}")->assertOk()->assertJsonCount(0, 'items')->assertJsonPath('totalAmount', null);
        $this->assertStringNotContainsString('Other supplier private quote', $r->getContent());
        Sanctum::actingAs($quoted);
        $this->getJson("/api/supplier-history/{$p->id}")->assertNotFound();
    }

    public function test_unknown_completion_and_missing_values_stay_unknown_and_reading_never_changes_records(): void
    {
        $supplier = $this->user();
        $p = $this->project($this->user('homeowner'), ['Finishing Works' => $supplier->id], [$this->material('Finishing Works', 'Unpriced estimate', ['unitPrice' => null])]);
        $p->update(['completion_confirmed_at' => null]);
        $before = $p->fresh()->getRawOriginal();
        Sanctum::actingAs($supplier);
        foreach ([1, 2] as $request) {
            $this->getJson("/api/supplier-history/{$p->id}")->assertOk()->assertJsonPath('completedAt', null)->assertJsonPath('totalAmount', null)->assertJsonPath('items.0.unitPrice', null);
        }
        $this->assertSame($before, $p->fresh()->getRawOriginal());
    }

    public function test_default_history_is_authenticated_supplier_only(): void
    {
        $this->getJson('/api/supplier-history')->assertUnauthorized();
        foreach (['homeowner', 'worker', 'contractor', 'admin', 'superadmin'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/supplier-history')->assertForbidden();
        }
    }

    public function test_deleted_legacy_quote_without_a_source_snapshot_is_withheld_instead_of_guessed(): void
    {
        $supplier = $this->user();
        $p = $this->project($this->user('homeowner'), ['Construction Materials' => $supplier->id], [
            $this->material('Construction Materials', 'Unverified private quote', ['supplierProductId' => 999999]),
        ]);
        Sanctum::actingAs($supplier);
        $r = $this->getJson("/api/supplier-history/{$p->id}")->assertOk()->assertJsonCount(0, 'items')
            ->assertJsonPath('unverifiedSourceCount', 1)->assertJsonPath('totalAmount', null);
        $this->assertStringNotContainsString('Unverified private quote', $r->getContent());
    }

    public function test_selected_history_survives_logout_and_a_new_authenticated_session(): void
    {
        $supplier = $this->user();
        $p = $this->project($this->user('homeowner'), ['Finishing Works' => $supplier->id], [$this->material('Finishing Works', 'Saved paint')]);
        $login = $this->postJson('/api/auth/login', ['email' => $supplier->email, 'password' => 'password'])->assertOk();
        $this->app['auth']->forgetGuards();
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];
        $first = $this->getJson('/api/supplier-history', $headers)->assertOk()->assertJsonPath('0.id', $p->id)->json();
        $this->postJson('/api/auth/logout', [], $headers)->assertNoContent();
        $this->app['auth']->forgetGuards();
        $next = $this->postJson('/api/auth/login', ['email' => $supplier->email, 'password' => 'password'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/supplier-history', ['Authorization' => 'Bearer '.$next->json('token')])->assertOk()->assertExactJson($first);
    }
}
