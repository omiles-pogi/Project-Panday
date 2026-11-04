<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Project;
use App\Models\QuoteRequest;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteBiddingTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    private function supplier(string $name): User
    {
        return $this->user('supplier', ['name' => $name, 'business_name' => $name]);
    }

    /** @return array{0: Project, 1: User, 2: User} project, owner, assigned contractor */
    private function site(): array
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House', 'location' => 'Quezon City', 'budget' => 2500000, 'totalEstimate' => 2420000, 'timelineMonths' => 6,
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'durationWeeks' => 26, 'tasks' => ['Pour slab']]],
        ]);
        $project->contractors()->attach($contractor->id);

        return [$project, $owner, $contractor];
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Slab materials',
            'notes' => 'Deliver to the gate.',
            'items' => [
                ['material_name' => 'Portland Cement 40kg', 'unit' => 'bag', 'quantity' => 100],
                ['material_name' => '10mm Rebar', 'unit' => 'pc', 'quantity' => 50],
            ],
        ], $overrides);
    }

    private function ask(User $requester, Project $project, array $overrides = []): QuoteRequest
    {
        Sanctum::actingAs($requester);
        $id = $this->postJson("/api/projects/{$project->id}/quote-requests", $this->payload($overrides))->assertCreated()->json('id');

        return QuoteRequest::with('items')->findOrFail($id);
    }

    /** A bid pricing each of the request's items in order. */
    private function bidBody(QuoteRequest $request, array $prices, int $days = 3, ?string $note = null): array
    {
        return [
            'delivery_days' => $days,
            'note' => $note,
            'items' => $request->items->values()->map(fn ($item, $i) => ['item_id' => $item->id, 'unit_price' => $prices[$i]])->all(),
        ];
    }

    private function bid(User $supplier, QuoteRequest $request, array $prices, int $days = 3, ?string $note = null)
    {
        Sanctum::actingAs($supplier);

        return $this->putJson("/api/quote-requests/{$request->id}/bid", $this->bidBody($request, $prices, $days, $note));
    }

    private function notificationsFor(User $user, string $type)
    {
        return AppNotification::where('user_id', $user->id)->where('type', $type)->get();
    }

    // ---- asking for quotes ---------------------------------------------------------------------

    public function test_the_homeowner_posts_a_request_and_every_approved_supplier_is_told(): void
    {
        [$project, $owner] = $this->site();
        $acme = $this->supplier('Acme');
        $beta = $this->supplier('Beta');
        $pending = $this->user('supplier', ['approval_status' => 'pending']);

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/quote-requests", $this->payload(['needed_by' => now()->addDays(10)->toDateString()]))
            ->assertCreated()
            ->assertJsonPath('status', 'open')
            ->assertJsonPath('projectTitle', 'My House')
            ->assertJsonPath('title', 'Slab materials')
            ->assertJsonCount(2, 'items')
            ->assertJsonCount(0, 'bids');

        foreach ([$acme, $beta] as $supplier) {
            $this->assertCount(1, $this->notificationsFor($supplier, 'quote_request_received'));
        }
        $this->assertCount(0, $this->notificationsFor($pending, 'quote_request_received'));
        $this->assertCount(0, $this->notificationsFor($owner, 'quote_request_received'));
    }

    public function test_an_assigned_contractor_can_ask_too_but_outsiders_and_idle_projects_cannot(): void
    {
        [$project, , $contractor] = $this->site();

        $this->ask($contractor, $project);

        foreach ([$this->user('homeowner'), $this->user('contractor')] as $outsider) {
            Sanctum::actingAs($outsider);
            $this->postJson("/api/projects/{$project->id}/quote-requests", $this->payload())
                ->assertStatus(422)->assertJsonPath('error', 'You cannot request quotes for this project.');
        }

        $project->update(['status' => 'completed']);
        Sanctum::actingAs($contractor);
        $this->postJson("/api/projects/{$project->id}/quote-requests", $this->payload())
            ->assertStatus(422)->assertJsonPath('error', 'Quotes can only be requested for an active project.');

        Sanctum::actingAs($this->supplier('Acme'));
        $this->postJson("/api/projects/{$project->id}/quote-requests", $this->payload())->assertForbidden();
    }

    public function test_a_request_needs_a_title_and_sensible_items(): void
    {
        [$project, $owner] = $this->site();
        Sanctum::actingAs($owner);
        $url = "/api/projects/{$project->id}/quote-requests";

        $this->postJson($url, $this->payload(['title' => '']))->assertStatus(422)->assertJsonValidationErrors('title');
        $this->postJson($url, $this->payload(['items' => []]))->assertStatus(422)->assertJsonValidationErrors('items');
        $this->postJson($url, $this->payload(['items' => [['material_name' => 'Sand', 'unit' => 'cu.m', 'quantity' => 0]]]))
            ->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');
        $this->postJson($url, $this->payload(['needed_by' => now()->subDays(2)->toDateString()]))
            ->assertStatus(422)->assertJsonValidationErrors('needed_by');
    }

    // ---- bidding -------------------------------------------------------------------------------

    public function test_a_supplier_sees_open_requests_without_who_asked_or_anyone_elses_bid(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $acme = $this->supplier('Acme');
        $beta = $this->supplier('Beta');
        $this->bid($beta, $request, [250, 120])->assertOk();

        Sanctum::actingAs($acme);
        $response = $this->getJson('/api/supplier/quote-requests')->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.projectTitle', 'My House')
            ->assertJsonPath('0.location', 'Quezon City')
            ->assertJsonPath('0.myBid', null)
            ->assertJsonPath('0.bidCount', 1);

        $this->assertArrayNotHasKey('requestedBy', $response->json('0'));
        $this->assertArrayNotHasKey('bids', $response->json('0'));
    }

    public function test_a_bid_is_totalled_and_the_requester_is_told(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $acme = $this->supplier('Acme');

        $this->bid($acme, $request, [250, 120], days: 4, note: 'Free delivery')
            ->assertOk()
            ->assertJsonPath('myBid.total', 31000)
            ->assertJsonPath('myBid.deliveryDays', 4)
            ->assertJsonPath('myBid.note', 'Free delivery')
            ->assertJsonPath('myBid.status', 'pending');

        $notice = $this->notificationsFor($owner, 'quote_bid_received')->sole();
        $this->assertSame('New quote received', $notice->title);
        $this->assertStringContainsString('Acme quoted', $notice->body);
        $this->assertSame($request->id, $notice->data['quoteRequestId']);
    }

    public function test_a_bid_has_to_price_every_item_exactly_once(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $first = $request->items[0]->id;
        Sanctum::actingAs($this->supplier('Acme'));
        $url = "/api/quote-requests/{$request->id}/bid";

        $this->putJson($url, ['delivery_days' => 2, 'items' => [['item_id' => $first, 'unit_price' => 250]]])
            ->assertStatus(422)->assertJsonPath('error', 'Price every item on the request, once each.');
        $this->putJson($url, ['delivery_days' => 2, 'items' => [['item_id' => $first, 'unit_price' => 250], ['item_id' => $first, 'unit_price' => 250]]])
            ->assertStatus(422);
        $this->putJson($url, ['delivery_days' => 2, 'items' => [['item_id' => $first, 'unit_price' => 250], ['item_id' => 99999, 'unit_price' => 100]]])
            ->assertStatus(422);
        $this->putJson($url, ['delivery_days' => 2, 'items' => [['item_id' => $first, 'unit_price' => 0], ['item_id' => $request->items[1]->id, 'unit_price' => 100]]])
            ->assertStatus(422)->assertJsonValidationErrors('items.0.unit_price');
        $this->putJson($url, ['items' => $this->bidBody($request, [250, 120])['items']])->assertStatus(422)->assertJsonValidationErrors('delivery_days');
    }

    public function test_only_approved_suppliers_can_bid_and_buyers_cannot(): void
    {
        [$project, $owner, $contractor] = $this->site();
        $request = $this->ask($owner, $project);

        $this->bid($this->user('supplier', ['approval_status' => 'pending']), $request, [250, 120])
            ->assertStatus(422)->assertJsonPath('error', 'Your account must be approved before you can bid.');

        foreach ([$owner, $contractor] as $buyer) {
            Sanctum::actingAs($buyer);
            $this->putJson("/api/quote-requests/{$request->id}/bid", $this->bidBody($request, [250, 120]))->assertForbidden();
            $this->getJson('/api/supplier/quote-requests')->assertForbidden();
        }
    }

    public function test_revising_a_bid_replaces_it_instead_of_stacking_another(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $acme = $this->supplier('Acme');

        $this->bid($acme, $request, [250, 120])->assertOk();
        $this->bid($acme, $request, [240, 110], days: 2)->assertOk()->assertJsonPath('myBid.total', 29500)->assertJsonPath('myBid.deliveryDays', 2);

        $this->assertSame(1, $request->bids()->count());
        $this->assertSame(2, $request->bids()->first()->items()->count());
        $this->assertSame('Quote updated', $this->notificationsFor($owner, 'quote_bid_received')->last()->title);

        Sanctum::actingAs($owner);
        $this->getJson('/api/quote-requests')->assertOk()->assertJsonCount(1, '0.bids');
    }

    public function test_a_supplier_can_withdraw_and_bid_again(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $acme = $this->supplier('Acme');
        $this->bid($acme, $request, [250, 120])->assertOk();

        Sanctum::actingAs($acme);
        $this->deleteJson("/api/quote-requests/{$request->id}/bid")->assertOk()->assertJsonPath('myBid', null)->assertJsonPath('bidCount', 0);

        Sanctum::actingAs($owner);
        $this->getJson('/api/quote-requests')->assertOk()->assertJsonCount(0, '0.bids');

        $this->bid($acme, $request, [260, 130])->assertOk()->assertJsonPath('myBid.status', 'pending');
        $this->assertSame(1, $request->bids()->count());
    }

    // ---- comparing and awarding ----------------------------------------------------------------

    public function test_the_requester_compares_bids_cheapest_first_with_the_lowest_flagged(): void
    {
        [$project, $owner, $contractor] = $this->site();
        $request = $this->ask($owner, $project);
        $this->bid($this->supplier('Acme'), $request, [250, 120], days: 5);
        $this->bid($this->supplier('Beta'), $request, [230, 110], days: 7);
        $this->bid($this->supplier('Gamma'), $request, [260, 130], days: 1);

        foreach ([$owner, $contractor] as $viewer) {
            Sanctum::actingAs($viewer);
            $response = $this->getJson('/api/quote-requests')->assertOk()->assertJsonCount(1);

            $this->assertSame(['Beta', 'Acme', 'Gamma'], array_column($response->json('0.bids'), 'supplierName'));
            $this->assertSame([true, false, false], array_column($response->json('0.bids'), 'isLowest'));
            $this->assertSame(28500, $response->json('0.bids.0.total'));
            $this->assertSame(23000, $response->json('0.bids.0.items.0.subtotal'));
        }
    }

    public function test_each_buyer_only_sees_requests_on_their_own_projects(): void
    {
        [$project, $owner] = $this->site();
        [$otherProject, $otherOwner] = $this->site();
        $this->ask($owner, $project);
        $this->ask($otherOwner, $otherProject, ['title' => 'Roof materials']);

        Sanctum::actingAs($owner);
        $this->getJson('/api/quote-requests')->assertOk()->assertJsonCount(1)->assertJsonPath('0.title', 'Slab materials');
        Sanctum::actingAs($otherOwner);
        $this->getJson('/api/quote-requests')->assertOk()->assertJsonCount(1)->assertJsonPath('0.title', 'Roof materials');
    }

    public function test_awarding_picks_one_winner_closes_the_request_and_tells_every_bidder(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $acme = $this->supplier('Acme');
        $beta = $this->supplier('Beta');
        $gamma = $this->supplier('Gamma');
        $this->bid($acme, $request, [250, 120]);
        $this->bid($beta, $request, [230, 110]);
        $this->bid($gamma, $request, [260, 130])->assertOk();
        Sanctum::actingAs($gamma);
        $this->deleteJson("/api/quote-requests/{$request->id}/bid")->assertOk();
        $betaBid = $request->bids()->where('supplier_id', $beta->id)->first();

        Sanctum::actingAs($owner);
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => $betaBid->id])
            ->assertOk()->assertJsonPath('status', 'awarded')->assertJsonPath('awardedBidId', $betaBid->id);

        $this->assertSame('accepted', $betaBid->fresh()->status);
        $this->assertSame('rejected', $request->bids()->where('supplier_id', $acme->id)->first()->status);
        $this->assertSame('withdrawn', $request->bids()->where('supplier_id', $gamma->id)->first()->status);

        $this->assertSame('You won the bid', $this->notificationsFor($beta, 'quote_bid_awarded')->sole()->title);
        $this->assertCount(1, $this->notificationsFor($acme, 'quote_bid_not_selected'));
        $this->assertCount(0, $this->notificationsFor($gamma, 'quote_bid_not_selected'));
    }

    public function test_a_closed_request_takes_no_more_bids_and_cannot_be_awarded_twice(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $acme = $this->supplier('Acme');
        $beta = $this->supplier('Beta');
        $this->bid($acme, $request, [250, 120]);
        $this->bid($beta, $request, [230, 110]);
        $acmeBid = $request->bids()->where('supplier_id', $acme->id)->first();

        Sanctum::actingAs($owner);
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => $acmeBid->id])->assertOk();
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => $acmeBid->id])
            ->assertStatus(422)->assertJsonPath('error', 'This quote request is no longer open.');
        $this->postJson("/api/quote-requests/{$request->id}/cancel")->assertStatus(422);

        $this->bid($this->supplier('Late'), $request, [100, 100])->assertStatus(422)->assertJsonPath('error', 'This quote request is no longer taking bids.');
        Sanctum::actingAs($acme);
        $this->deleteJson("/api/quote-requests/{$request->id}/bid")->assertStatus(422);

        // The bidders still see how it went.
        $this->getJson('/api/supplier/quote-requests')->assertOk()->assertJsonPath('0.status', 'awarded')->assertJsonPath('0.myBid.status', 'accepted');
        Sanctum::actingAs($beta);
        $this->getJson('/api/supplier/quote-requests')->assertOk()->assertJsonPath('0.myBid.status', 'rejected');
        // Someone who never bid no longer sees a closed request.
        Sanctum::actingAs($this->supplier('Latecomer'));
        $this->getJson('/api/supplier/quote-requests')->assertOk()->assertJsonCount(0);
    }

    public function test_only_a_pending_bid_on_this_request_can_be_awarded_and_only_by_the_people_running_it(): void
    {
        [$project, $owner] = $this->site();
        $request = $this->ask($owner, $project);
        $other = $this->ask($owner, $project, ['title' => 'Roof']);
        $acme = $this->supplier('Acme');
        $this->bid($acme, $request, [250, 120]);
        $this->bid($acme, $other, [100, 100]);
        $bid = $request->bids()->first();
        $foreignBid = $other->bids()->first();

        Sanctum::actingAs($this->user('homeowner'));
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => $bid->id])
            ->assertStatus(422)->assertJsonPath('error', 'You cannot manage this quote request.');

        Sanctum::actingAs($owner);
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => $foreignBid->id])
            ->assertStatus(422)->assertJsonPath('error', 'That bid is not available to award.');
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => 99999])->assertStatus(422);
        $this->postJson("/api/quote-requests/{$request->id}/award", [])->assertStatus(422)->assertJsonValidationErrors('bid_id');

        Sanctum::actingAs($acme);
        $this->postJson("/api/quote-requests/{$request->id}/award", ['bid_id' => $bid->id])->assertForbidden();
    }

    public function test_cancelling_closes_the_request_and_tells_the_bidders(): void
    {
        [$project, $owner, $contractor] = $this->site();
        $request = $this->ask($contractor, $project);
        $acme = $this->supplier('Acme');
        $this->bid($acme, $request, [250, 120]);

        Sanctum::actingAs($owner);
        $this->postJson("/api/quote-requests/{$request->id}/cancel")->assertOk()->assertJsonPath('status', 'cancelled');

        $this->assertCount(1, $this->notificationsFor($acme, 'quote_request_cancelled'));
        $this->bid($acme, $request, [240, 110])->assertStatus(422);
        $this->assertSame('cancelled', $request->fresh()->status);

        Sanctum::actingAs($this->user('homeowner'));
        $this->postJson("/api/quote-requests/{$request->id}/cancel")->assertStatus(422);
    }
}
