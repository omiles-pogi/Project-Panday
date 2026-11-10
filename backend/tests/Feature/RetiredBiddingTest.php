<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RetiredBiddingTest extends TestCase
{
    use RefreshDatabase;

    public function test_obsolete_endpoints_are_unavailable_to_every_role(): void
    {
        $endpoints = [
            ['GET', '/api/quote-requests'],
            ['POST', '/api/projects/1/quote-requests'],
            ['POST', '/api/quote-requests/1/award'],
            ['POST', '/api/quote-requests/1/cancel'],
            ['GET', '/api/supplier/quote-requests'],
            ['PUT', '/api/quote-requests/1/bid'],
            ['DELETE', '/api/quote-requests/1/bid'],
        ];

        foreach (User::ROLES as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role, 'approval_status' => 'approved']));
            foreach ($endpoints as [$method, $url]) {
                $this->json($method, $url)->assertNotFound();
            }
        }
    }

    public function test_historical_notifications_are_inaccessible_and_retained_when_the_feed_is_cleared(): void
    {
        $supplier = User::factory()->create(['role' => 'supplier', 'approval_status' => 'approved']);
        $retired = [
            'quote_request_received', 'quote_bid_received', 'quote_bid_awarded',
            'quote_bid_not_selected', 'quote_request_cancelled',
        ];
        $ids = [];
        foreach ($retired as $type) {
            // Raw inserts represent records retained from before removal of the feature.
            $ids[] = DB::table('app_notifications')->insertGetId([
                'user_id' => $supplier->id, 'type' => $type, 'title' => 'Historical notice',
                'body' => 'Historical body', 'data' => json_encode(['quoteRequestId' => 1]),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $active = AppNotification::create([
            'user_id' => $supplier->id, 'type' => 'supplier_price_confirmation',
            'title' => 'Material price confirmation', 'body' => 'Current workflow',
            'data' => ['materialRequestId' => 2, 'supplierFulfillmentId' => 3],
        ]);
        Sanctum::actingAs($supplier);

        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $active->id)->assertJsonPath('0.data.materialRequestId', 2);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('count', 1);
        foreach ($ids as $id) {
            $this->patchJson("/api/notifications/{$id}/read")->assertNotFound();
            $this->deleteJson("/api/notifications/{$id}")->assertNotFound();
        }

        $this->postJson('/api/notifications/read-all')->assertNoContent();
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('count', 0);
        $this->assertSame(count($ids), DB::table('app_notifications')->whereIn('id', $ids)->whereNull('read_at')->count());
        $this->deleteJson('/api/notifications')->assertOk()->assertJsonPath('cleared', 1)->assertJsonPath('kept', 0);
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
        $this->assertSame(count($ids), DB::table('app_notifications')->whereIn('id', $ids)->count());
    }
}
