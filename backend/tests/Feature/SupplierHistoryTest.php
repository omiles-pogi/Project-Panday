<?php

namespace Tests\Feature;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\Project;
use App\Models\SupplierFulfillment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupplierHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'supplier'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(?User $owner = null, string $title = 'Recorded residence'): Project
    {
        return Project::create(['user_id' => ($owner ?? $this->user('homeowner'))->id, 'title' => $title,
            'status' => 'active', 'location' => 'Dagupan', 'budget' => 900000, 'total_estimate' => 850000,
            'timeline_value' => 6, 'timeline_unit' => 'months', 'started_at' => '2026-01-01',
            'approved_plan' => ['floors' => 2, 'description' => 'Private construction description', 'budget' => 900000]]);
    }

    private function receipt(User $supplier, Project $project, string $status = SupplierFulfillment::RECEIVED, ?string $date = '2026-11-11 10:00:00'): SupplierFulfillment
    {
        $request = MaterialRequest::create(['project_id' => $project->id, 'homeowner_id' => $project->user_id,
            'contractor_id' => $this->user('contractor')->id, 'status' => MaterialRequest::APPROVED]);
        $receipt = SupplierFulfillment::create(['material_request_id' => $request->id, 'supplier_id' => $supplier->id,
            'status' => $status, 'received_at' => $date]);
        $this->line($receipt, $supplier);

        return $receipt;
    }

    private function line(SupplierFulfillment $receipt, User $supplier, array $overrides = []): MaterialRequestItem
    {
        return MaterialRequestItem::create(array_merge(['material_request_id' => $receipt->material_request_id,
            'supplier_order_id' => $receipt->id, 'supplier_id' => $supplier->id, 'material_name' => 'Recorded cement',
            'unit' => 'bag', 'quantity' => 10, 'estimated_unit_price' => 250, 'confirmed_unit_price' => 280,
            'status' => MaterialRequestItem::CONFIRMED], $overrides));
    }

    public function test_empty_history_and_supplier_only_read_access(): void
    {
        $this->getJson('/api/supplier-history')->assertUnauthorized();
        foreach (['homeowner', 'contractor', 'worker', 'admin', 'superadmin'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/supplier-history')->assertForbidden();
            $this->getJson('/api/supplier-history/1')->assertForbidden();
        }
        Sanctum::actingAs($this->user());
        $this->getJson('/api/supplier-history')->assertOk()->assertExactJson([]);
        $this->getJson('/api/supplier-history/1')->assertNotFound();
        $this->getJson('/api/supplier-history/not-an-id')->assertNotFound();
        $this->postJson('/api/supplier-history')->assertStatus(405);
    }

    public function test_received_lines_group_once_per_project_with_actual_homeowner_dates_and_totals(): void
    {
        $supplier = $this->user();
        $owner = $this->user('homeowner');
        $project = $this->project($owner);
        $old = $this->receipt($supplier, $project, date: '2026-11-09 10:00:00');
        $this->line($old, $supplier, ['material_name' => 'Recorded sand', 'unit' => 'm³', 'quantity' => 3, 'confirmed_unit_price' => 800]);
        $latest = $this->receipt($supplier, $project);
        // A real receipt remains history if another supplier sends the parent request for revision.
        $latest->materialRequest->update(['status' => MaterialRequest::REVISION]);
        foreach ([SupplierFulfillment::SUPPLIER_REVIEW, SupplierFulfillment::AWAITING_HOMEOWNER,
            SupplierFulfillment::CONFIRMED, SupplierFulfillment::UNAVAILABLE, SupplierFulfillment::CANCELLED] as $status) {
            $this->receipt($supplier, $project, $status);
        }
        $newer = $this->project(title: 'Newest receipt project');
        $this->receipt($supplier, $newer, date: '2026-11-12 10:00:00');
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-history')->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.id', $newer->id)->assertJsonPath('1.id', $project->id)
            ->assertJsonPath('1.homeownerName', $owner->name)->assertJsonPath('1.receiptCount', 2)
            ->assertJsonPath('1.lineCount', 3)->assertJsonPath('1.totalAmount', 8000);
        $response = $this->getJson("/api/supplier-history/{$project->id}")->assertOk()
            ->assertJsonCount(3, 'items')->assertJsonPath('projectType', '2-storey house')
            ->assertJsonPath('location', 'Dagupan')->assertJsonPath('items.0.fulfillmentId', $latest->id)
            ->assertJsonPath('items.0.fulfillmentStatus', 'received');
        $this->assertStringStartsWith('2026-11-11', $response->json('lastReceivedAt'));
        $this->assertStringNotContainsString('Private construction description', $response->getContent());
        $this->assertArrayNotHasKey('description', $response->json());
        $this->assertArrayNotHasKey('approvedPlan', $response->json());
    }

    public function test_supplier_cannot_access_unrelated_projects_or_another_suppliers_private_lines(): void
    {
        $supplier = $this->user();
        $other = $this->user();
        $own = $this->project();
        $foreign = $this->project();
        $this->receipt($supplier, $own);
        $this->receipt($other, $foreign);
        $private = $this->receipt($other, $own);
        $private->items()->update(['material_name' => 'Other supplier private item', 'confirmed_unit_price' => 99999]);
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-history')->assertOk()->assertJsonCount(1)->assertJsonPath('0.totalAmount', 2800);
        $this->getJson("/api/supplier-history/{$foreign->id}")->assertNotFound();
        $response = $this->getJson("/api/supplier-history/{$own->id}")->assertOk()->assertJsonCount(1, 'items');
        $this->assertStringNotContainsString('Other supplier private item', $response->getContent());
        $this->assertStringNotContainsString('99999', $response->getContent());
    }

    public function test_history_uses_final_price_snapshots_after_listing_changes_and_deletion(): void
    {
        $supplier = $this->user();
        $project = $this->project();
        $receipt = $this->receipt($supplier, $project);
        $product = $supplier->supplierProducts()->create(['name' => 'Current product name', 'category' => 'Cement', 'unit' => 'bag', 'price' => 280, 'stock' => 100]);
        $receipt->items()->update(['supplier_product_id' => $product->id]);
        $product->update(['price' => 9999, 'name' => 'Renamed inventory product']);
        Sanctum::actingAs($supplier);
        $this->getJson("/api/supplier-history/{$project->id}")->assertOk()
            ->assertJsonPath('items.0.name', 'Recorded cement')->assertJsonPath('items.0.unitPrice', 280)->assertJsonPath('totalAmount', 2800);
        $product->delete();
        $this->getJson("/api/supplier-history/{$project->id}")->assertOk()->assertJsonPath('totalAmount', 2800);
        $unknown = $this->project();
        $legacy = $this->receipt($supplier, $unknown, date: null);
        $legacy->items()->update(['confirmed_unit_price' => null]);
        $this->line($legacy, $supplier, ['confirmed_unit_price' => 0, 'quantity' => 1]);
        $this->getJson("/api/supplier-history/{$unknown->id}")->assertOk()->assertJsonPath('lastReceivedAt', null)
            ->assertJsonPath('totalAmount', null)->assertJsonPath('missingPriceCount', 1)
            ->assertJsonPath('items.0.unitPrice', null)->assertJsonPath('items.1.lineTotal', 0);
    }

    public function test_cancelled_rejected_and_inconsistent_records_do_not_qualify(): void
    {
        $supplier = $this->user();
        $other = $this->user();
        foreach ([MaterialRequest::CANCELLED, MaterialRequest::REJECTED, MaterialRequest::DRAFT, MaterialRequest::PENDING] as $status) {
            $receipt = $this->receipt($supplier, $this->project());
            $receipt->materialRequest->update(['status' => $status]);
        }
        $receipt = $this->receipt($supplier, $this->project());
        $receipt->items()->update(['status' => MaterialRequestItem::PENDING]);
        $receipt = $this->receipt($supplier, $this->project());
        $receipt->items()->update(['supplier_id' => $other->id]);
        $receipt = $this->receipt($supplier, $this->project());
        $receipt->items()->update(['material_request_id' => 1]);
        $this->receipt($supplier, $this->project($this->user('contractor')));
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-history')->assertOk()->assertExactJson([]);
    }

    public function test_reading_history_preserves_all_records_and_ignores_home_dashboard_visibility(): void
    {
        $supplier = $this->user();
        $project = $this->project();
        $this->receipt($supplier, $project);
        DB::table('projects')->where('id', $project->id)->update(['status' => 'completed', 'is_hidden_from_dashboard' => true]);
        $snapshot = fn () => collect(['projects', 'material_requests', 'supplier_fulfillments', 'material_request_items', 'users'])
            ->mapWithKeys(fn ($table) => [$table => DB::table($table)->orderBy('id')->get()->toJson()])->all();
        $before = $snapshot();
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-history')->assertOk()->assertJsonCount(1);
        $this->getJson("/api/supplier-history/{$project->id}")->assertOk();
        $this->assertSame($before, $snapshot());
    }
}
