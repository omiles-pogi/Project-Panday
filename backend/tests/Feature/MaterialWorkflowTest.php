<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\SupplierOrder;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaterialWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $homeowner;

    private User $contractor;

    private User $supplierA;

    private User $supplierB;

    private Project $project;

    private SupplierProduct $cement;

    private SupplierProduct $rebar;

    protected function setUp(): void
    {
        parent::setUp();

        $this->homeowner = $this->user('homeowner');
        $this->contractor = $this->user('contractor');
        $this->supplierA = $this->user('supplier', ['business_name' => 'Alpha Hardware']);
        $this->supplierB = $this->user('supplier', ['business_name' => 'Bravo Steel']);

        $this->project = app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Dela Cruz Residence',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2400000,
            'timelineMonths' => 6,
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100]],
            'materials' => [
                ['material' => 'Portland Cement', 'category' => 'Cement', 'qty' => 99.5, 'unit' => 'bag', 'unitPrice' => 250],
                ['material' => 'Mystery Tiles', 'category' => 'Finishing', 'qty' => 40, 'unit' => 'box', 'unitPrice' => 900],
            ],
        ]);
        $this->project->contractors()->attach($this->contractor->id);

        $this->cement = $this->supplierA->supplierProducts()->create(['name' => 'Portland Cement', 'category' => 'Cement', 'unit' => 'bag', 'price' => 280, 'stock' => 100]);
        $this->rebar = $this->supplierB->supplierProducts()->create(['name' => 'Rebar 10mm', 'category' => 'Steel', 'unit' => 'kg', 'price' => 70, 'stock' => 500]);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    /** Creates a draft with cement (A) + rebar (B) and returns its id. */
    private function draft(int $cementQty = 40, int $rebarQty = 200): int
    {
        Sanctum::actingAs($this->contractor);
        $id = $this->postJson('/api/material-requests', ['project_id' => $this->project->id, 'notes' => 'Foundation pour'])
            ->assertStatus(201)
            ->assertJsonPath('status', 'draft')
            ->json('id');

        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['supplier_product_id' => $this->cement->id, 'quantity' => $cementQty],
            ['supplier_product_id' => $this->rebar->id, 'quantity' => $rebarQty],
        ]])->assertStatus(200);

        return $id;
    }

    private function submitAndApprove(int $id): void
    {
        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/submit")->assertStatus(200)->assertJsonPath('status', 'pending_homeowner_approval');
        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/material-requests/{$id}/approve")->assertStatus(200)->assertJsonPath('status', 'approved');
    }

    private function orderFor(int $requestId, User $supplier): SupplierOrder
    {
        return SupplierOrder::where('material_request_id', $requestId)->where('supplier_id', $supplier->id)->latest('id')->firstOrFail();
    }

    public function test_full_workflow_from_draft_to_completed(): void
    {
        $id = $this->draft();

        // Totals use the listing's real prices, never client-sent ones: 40×280 + 200×70.
        Sanctum::actingAs($this->contractor);
        $this->getJson("/api/material-requests/{$id}")
            ->assertJsonPath('estimatedTotal', 25200)
            ->assertJsonPath('items.0.estimatedSubtotal', 11200)
            ->assertJsonPath('items.1.estimatedSubtotal', 14000);

        // Drafts touch no stock; neither does approval.
        $this->submitAndApprove($id);
        $this->assertSame(0, $this->cement->fresh()->reserved);
        $this->assertSame(2, SupplierOrder::where('material_request_id', $id)->count());

        foreach ([[$this->supplierA, $this->cement, 40], [$this->supplierB, $this->rebar, 200]] as [$supplier, $product, $qty]) {
            $order = $this->orderFor($id, $supplier);
            Sanctum::actingAs($supplier);
            $this->postJson("/api/supplier-orders/{$order->id}/confirm", ['expected_delivery_date' => now()->addDays(3)->toDateString()])
                ->assertStatus(200)
                ->assertJsonPath('status', 'confirmed');
            $this->assertSame($qty, $product->fresh()->reserved);

            foreach (['preparing', 'for_delivery', 'delivered'] as $status) {
                $this->postJson("/api/supplier-orders/{$order->id}/status", ['status' => $status])->assertStatus(200)->assertJsonPath('status', $status);
            }
            // Delivery deducts on-hand stock and clears the reservation; a repeat tap is refused.
            $this->assertSame(0, $product->fresh()->reserved);
            $this->postJson("/api/supplier-orders/{$order->id}/status", ['status' => 'delivered'])->assertStatus(422);

            Sanctum::actingAs($this->contractor);
            $this->postJson("/api/supplier-orders/{$order->id}/receive")->assertStatus(200);
        }

        $this->assertSame(60, $this->cement->fresh()->stock);
        $this->assertSame(300, $this->rebar->fresh()->stock);
        Sanctum::actingAs($this->homeowner);
        $this->getJson("/api/material-requests/{$id}")
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('confirmedTotal', 25200)
            ->assertJsonPath('orders.0.status', 'received');
        $this->assertTrue(AppNotification::where('user_id', $this->homeowner->id)->where('type', 'material_request_completed')->exists());
    }

    public function test_only_an_assigned_contractor_can_create_requests(): void
    {
        Sanctum::actingAs($this->user('contractor'));
        $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->assertStatus(422);

        Sanctum::actingAs($this->homeowner);
        $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->assertStatus(403);
        $this->assertSame(0, MaterialRequest::count());
    }

    public function test_drafts_are_private_and_submission_notifies_the_homeowner(): void
    {
        $id = $this->draft();

        Sanctum::actingAs($this->homeowner);
        $this->getJson('/api/material-requests')->assertJsonCount(0);
        $this->getJson("/api/material-requests/{$id}")->assertStatus(422);

        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/submit")->assertStatus(200);
        $this->assertSame(1, AppNotification::where('user_id', $this->homeowner->id)->where('type', 'material_request_submitted')->count());

        Sanctum::actingAs($this->homeowner);
        $this->getJson('/api/material-requests')->assertJsonCount(1)->assertJsonPath('0.canDecide', true);
    }

    public function test_insufficient_stock_is_flagged_but_items_cannot_be_changed_after_submit(): void
    {
        $id = $this->draft(cementQty: 150);
        Sanctum::actingAs($this->contractor);
        $this->getJson("/api/material-requests/{$id}")
            ->assertJsonPath('items.0.insufficientStock', true)
            ->assertJsonPath('items.1.insufficientStock', false);

        $this->postJson("/api/material-requests/{$id}/submit")->assertStatus(200);
        $this->putJson("/api/material-requests/{$id}", ['items' => []])->assertStatus(422);
    }

    public function test_homeowner_can_request_revision_and_contractor_resubmits(): void
    {
        $id = $this->draft();
        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/submit");

        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/material-requests/{$id}/request-revision", [])->assertStatus(422); // reason required
        $this->postJson("/api/material-requests/{$id}/request-revision", ['reason' => 'Use 30 bags only'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'revision_requested')
            ->assertJsonPath('decisionReason', 'Use 30 bags only');

        Sanctum::actingAs($this->contractor);
        $items = $this->getJson("/api/material-requests/{$id}")->json('items');
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['id' => $items[0]['id'], 'supplier_product_id' => $this->cement->id, 'quantity' => 30],
            ['id' => $items[1]['id'], 'supplier_product_id' => $this->rebar->id, 'quantity' => 200],
        ]])->assertStatus(200)->assertJsonPath('estimatedTotal', 30 * 280 + 200 * 70);
        $this->postJson("/api/material-requests/{$id}/submit")->assertStatus(200)->assertJsonPath('status', 'pending_homeowner_approval');
    }

    public function test_homeowner_can_reject_with_a_reason(): void
    {
        $id = $this->draft();
        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/submit");

        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/material-requests/{$id}/reject", ['reason' => 'Over budget'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'rejected');
        $this->postJson("/api/material-requests/{$id}/approve")->assertStatus(422);
        $this->assertTrue(AppNotification::where('user_id', $this->contractor->id)->where('type', 'material_request_rejected')->exists());
    }

    public function test_suppliers_only_see_and_act_on_their_own_orders(): void
    {
        $id = $this->draft();
        $this->submitAndApprove($id);
        $orderA = $this->orderFor($id, $this->supplierA);
        $orderB = $this->orderFor($id, $this->supplierB);

        Sanctum::actingAs($this->supplierA);
        $this->getJson('/api/supplier-orders')
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $orderA->id)
            ->assertJsonCount(1, '0.items')
            ->assertJsonPath('0.items.0.materialName', 'Portland Cement')
            ->assertJsonMissingPath('0.homeowner');
        $this->getJson("/api/supplier-orders/{$orderB->id}")->assertStatus(422);
        $this->postJson("/api/supplier-orders/{$orderB->id}/confirm")->assertStatus(422);
        $this->postJson("/api/supplier-orders/{$orderB->id}/decline", ['reason' => 'x'])->assertStatus(422);
        $this->assertSame('supplier_review', $orderB->fresh()->status);

        // Suppliers can't reach the homeowner/contractor request endpoints at all.
        $this->getJson("/api/material-requests/{$id}")->assertStatus(403);

        // An unrelated supplier sees nothing.
        Sanctum::actingAs($this->user('supplier'));
        $this->getJson('/api/supplier-orders')->assertJsonCount(0);
    }

    public function test_a_supplier_cannot_confirm_more_than_available_and_reports_insufficient_stock(): void
    {
        $id = $this->draft(cementQty: 150);
        $this->submitAndApprove($id);
        $order = $this->orderFor($id, $this->supplierA);

        Sanctum::actingAs($this->supplierA);
        $this->getJson("/api/supplier-orders/{$order->id}")->assertJsonPath('items.0.insufficientStock', true);
        $this->postJson("/api/supplier-orders/{$order->id}/confirm")->assertStatus(422);
        $this->assertSame(0, $this->cement->fresh()->reserved);

        $this->postJson("/api/supplier-orders/{$order->id}/insufficient", ['reason' => 'Next shipment Friday'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'unavailable')
            ->assertJsonPath('items.0.status', 'insufficient');

        // Request returns to the contractor; supplier B's order is untouched.
        Sanctum::actingAs($this->contractor);
        $request = $this->getJson("/api/material-requests/{$id}")
            ->assertJsonPath('status', 'revision_requested')
            ->assertJsonPath('canEdit', true)
            ->json();
        $this->assertSame('supplier_review', $this->orderFor($id, $this->supplierB)->status);
        $this->assertTrue(AppNotification::where('user_id', $this->homeowner->id)->where('type', 'supplier_order_unavailable')->exists());

        // Contractor revises the failed line only (the rebar line is locked to B's live order).
        $cementItem = collect($request['items'])->firstWhere('materialName', 'Portland Cement');
        $rebarItem = collect($request['items'])->firstWhere('materialName', 'Rebar 10mm');
        $this->assertTrue($rebarItem['locked']);
        $this->putJson("/api/material-requests/{$id}", ['items' => [['id' => $rebarItem['id'], 'supplier_product_id' => $this->rebar->id, 'quantity' => 1]]])->assertStatus(422);
        $this->putJson("/api/material-requests/{$id}", ['items' => [['id' => $cementItem['id'], 'supplier_product_id' => $this->cement->id, 'quantity' => 80]]])->assertStatus(200);
        $this->submitAndApprove($id);

        // A fresh order goes to supplier A only for the revised line; B still has exactly one order.
        $this->assertSame(2, SupplierOrder::where('material_request_id', $id)->where('supplier_id', $this->supplierA->id)->count());
        $this->assertSame(1, SupplierOrder::where('material_request_id', $id)->where('supplier_id', $this->supplierB->id)->count());
        $newOrder = $this->orderFor($id, $this->supplierA);
        Sanctum::actingAs($this->supplierA);
        $this->postJson("/api/supplier-orders/{$newOrder->id}/confirm")->assertStatus(200)->assertJsonPath('status', 'confirmed');
        $this->assertSame(80, $this->cement->fresh()->reserved);
    }

    public function test_reserved_stock_is_never_promised_twice(): void
    {
        $first = $this->draft(cementQty: 70, rebarQty: 1);
        $this->submitAndApprove($first);
        $second = $this->draft(cementQty: 70, rebarQty: 1);
        $this->submitAndApprove($second);

        Sanctum::actingAs($this->supplierA);
        $this->postJson('/api/supplier-orders/'.$this->orderFor($first, $this->supplierA)->id.'/confirm')->assertStatus(200);
        // Only 30 of 100 remain available to promise now.
        $this->postJson('/api/supplier-orders/'.$this->orderFor($second, $this->supplierA)->id.'/confirm')->assertStatus(422);

        $fresh = $this->cement->fresh();
        $this->assertSame([100, 70, 30, 'in_stock'], [$fresh->stock, $fresh->reserved, $fresh->available_quantity, $fresh->stock_status]);

        // Supplier also can't drop on-hand below what's reserved, or delete the listing.
        $this->patchJson("/api/supplier-products/{$this->cement->id}", ['stock' => 50])->assertStatus(422);
        $this->deleteJson("/api/supplier-products/{$this->cement->id}")->assertStatus(422);
    }

    public function test_cancelling_releases_reservations_but_not_after_delivery(): void
    {
        $id = $this->draft();
        $this->submitAndApprove($id);
        $orderA = $this->orderFor($id, $this->supplierA);

        Sanctum::actingAs($this->supplierA);
        $this->postJson("/api/supplier-orders/{$orderA->id}/confirm")->assertStatus(200);
        $this->assertSame(40, $this->cement->fresh()->reserved);

        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/cancel", ['reason' => 'Design changed'])->assertStatus(200)->assertJsonPath('status', 'cancelled');
        $this->assertSame([100, 0], [$this->cement->fresh()->stock, $this->cement->fresh()->reserved]);
        $this->assertSame('cancelled', $orderA->fresh()->status);
        $this->assertTrue(AppNotification::where('user_id', $this->supplierA->id)->where('type', 'supplier_order_cancelled')->exists());

        // A cancelled order can't be advanced any more.
        Sanctum::actingAs($this->supplierA);
        $this->postJson("/api/supplier-orders/{$orderA->id}/status", ['status' => 'preparing'])->assertStatus(422);

        // After a delivery, cancelling is refused.
        $id2 = $this->draft();
        $this->submitAndApprove($id2);
        $o = $this->orderFor($id2, $this->supplierA);
        Sanctum::actingAs($this->supplierA);
        $this->postJson("/api/supplier-orders/{$o->id}/confirm");
        foreach (['preparing', 'for_delivery', 'delivered'] as $s) {
            $this->postJson("/api/supplier-orders/{$o->id}/status", ['status' => $s]);
        }
        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/material-requests/{$id2}/cancel")->assertStatus(422);
    }

    public function test_changed_final_prices_need_homeowner_confirmation(): void
    {
        $id = $this->draft();
        $this->submitAndApprove($id);
        $order = $this->orderFor($id, $this->supplierA);
        $itemId = $order->items()->first()->id;

        Sanctum::actingAs($this->supplierA);
        $this->postJson("/api/supplier-orders/{$order->id}/confirm", ['items' => [['id' => $itemId, 'unit_price' => 300]]])
            ->assertStatus(200)
            ->assertJsonPath('status', 'awaiting_homeowner_confirmation');
        // Can't start preparing until the homeowner accepts.
        $this->postJson("/api/supplier-orders/{$order->id}/status", ['status' => 'preparing'])->assertStatus(422);

        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/supplier-orders/{$order->id}/confirm-prices")->assertStatus(403);

        Sanctum::actingAs($this->homeowner);
        $this->getJson("/api/material-requests/{$id}")->assertJsonPath('orders.0.priceChanged', true)->assertJsonPath('orders.0.confirmedTotal', 12000);
        $this->postJson("/api/supplier-orders/{$order->id}/confirm-prices")->assertStatus(200);
        $this->assertSame('confirmed', $order->fresh()->status);
    }

    public function test_declining_changed_prices_cancels_that_order_and_returns_for_revision(): void
    {
        $id = $this->draft();
        $this->submitAndApprove($id);
        $order = $this->orderFor($id, $this->supplierA);

        Sanctum::actingAs($this->supplierA);
        $this->postJson("/api/supplier-orders/{$order->id}/confirm", ['items' => [['id' => $order->items()->first()->id, 'unit_price' => 400]]]);
        $this->assertSame(40, $this->cement->fresh()->reserved);

        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/supplier-orders/{$order->id}/decline-prices", ['reason' => 'Too expensive'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'revision_requested');
        $this->assertSame(0, $this->cement->fresh()->reserved);
        $this->assertSame('cancelled', $order->fresh()->status);
    }

    public function test_supplier_decline_requires_a_reason(): void
    {
        $id = $this->draft();
        $this->submitAndApprove($id);
        $order = $this->orderFor($id, $this->supplierB);

        Sanctum::actingAs($this->supplierB);
        $this->postJson("/api/supplier-orders/{$order->id}/decline")->assertStatus(422);
        $this->postJson("/api/supplier-orders/{$order->id}/decline", ['reason' => 'Discontinued'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'unavailable')
            ->assertJsonPath('items.0.status', 'unavailable');
    }

    public function test_only_the_contractor_confirms_receipt_and_only_after_delivery(): void
    {
        $id = $this->draft();
        $this->submitAndApprove($id);
        $order = $this->orderFor($id, $this->supplierA);

        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/supplier-orders/{$order->id}/receive")->assertStatus(422);

        Sanctum::actingAs($this->user('contractor'));
        $this->postJson("/api/supplier-orders/{$order->id}/receive")->assertStatus(422);
    }

    public function test_outsiders_cannot_view_or_modify_requests(): void
    {
        $id = $this->draft();
        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/submit");

        Sanctum::actingAs($this->user('homeowner'));
        $this->getJson("/api/material-requests/{$id}")->assertStatus(422);
        $this->postJson("/api/material-requests/{$id}/approve")->assertStatus(422);
        $this->postJson("/api/material-requests/{$id}/cancel")->assertStatus(422);

        Sanctum::actingAs($this->user('contractor'));
        $this->putJson("/api/material-requests/{$id}", ['items' => []])->assertStatus(422);
        $this->assertSame('pending_homeowner_approval', MaterialRequest::find($id)->status);

        // The contractor can't approve their own request.
        Sanctum::actingAs($this->contractor);
        $this->postJson("/api/material-requests/{$id}/approve")->assertStatus(403);
    }

    public function test_ai_materials_import_with_reliable_matches_only(): void
    {
        Sanctum::actingAs($this->contractor);
        $suggestions = $this->getJson("/api/projects/{$this->project->id}/ai-materials")->assertStatus(200);
        $suggestions->assertJsonCount(2)
            ->assertJsonPath('0.material', 'Portland Cement')
            ->assertJsonPath('0.quantity', 100)
            ->assertJsonPath('0.match.supplierProductId', $this->cement->id)
            ->assertJsonPath('1.material', 'Mystery Tiles')
            ->assertJsonPath('1.match', null);

        // An unmatched AI line can sit in a draft, but can't be submitted until a listing is chosen.
        $id = $this->postJson('/api/material-requests', ['project_id' => $this->project->id])->json('id');
        $this->putJson("/api/material-requests/{$id}", ['items' => [
            ['supplier_product_id' => $this->cement->id, 'quantity' => 100, 'source' => 'ai'],
            ['material_name' => 'Mystery Tiles', 'unit' => 'box', 'quantity' => 40, 'estimated_unit_price' => 900, 'source' => 'ai'],
        ]])->assertStatus(200)->assertJsonPath('items.1.supplierId', null)->assertJsonPath('items.1.source', 'ai');
        $this->postJson("/api/material-requests/{$id}/submit")->assertStatus(422);

        Sanctum::actingAs($this->user('contractor'));
        $this->getJson("/api/projects/{$this->project->id}/ai-materials")->assertStatus(422);
    }

    public function test_reserved_stock_shows_out_of_stock_in_the_catalog(): void
    {
        $id = $this->draft(cementQty: 100);
        $this->submitAndApprove($id);
        Sanctum::actingAs($this->supplierA);
        $this->postJson('/api/supplier-orders/'.$this->orderFor($id, $this->supplierA)->id.'/confirm')->assertStatus(200);

        Sanctum::actingAs($this->homeowner);
        $this->getJson("/api/materials/{$this->cement->id}")
            ->assertJsonPath('stock', 100)
            ->assertJsonPath('available_quantity', 0)
            ->assertJsonPath('stock_status', 'out_of_stock');
        $this->getJson('/api/materials?stock=out_of_stock')->assertJsonCount(1)->assertJsonPath('0.name', 'Portland Cement');
    }
}
