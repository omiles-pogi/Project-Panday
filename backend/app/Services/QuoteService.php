<?php

namespace App\Services;

use App\Models\Project;
use App\Models\QuoteBid;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestItem;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Supplier bidding. A homeowner — or a contractor on their project — posts a quote request, a list
 * of materials; every approved supplier is told, and each can bid a price per item. The requester
 * compares the bids (the lowest total is flagged) and awards one, which closes the request and tells
 * every bidder how it went.
 *
 * A bid has to price every item so the totals compare like for like, and a supplier has one bid per
 * request that they revise rather than stack. Suppliers never see each other's bids.
 *
 * Awarding records who won and at what prices; the purchase itself still goes through the usual
 * material request and supplier order flow.
 */
class QuoteService
{
    public function __construct(private readonly NotificationService $notifications) {}

    // ---- the requester's side ------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $data  A validated StoreQuoteRequestRequest payload.
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function create(Project $project, User $requester, array $data): array
    {
        if (! $project->canManageTeam($requester)) {
            throw ValidationException::withMessages(['project_id' => 'You cannot request quotes for this project.']);
        }
        if ($project->status !== 'active') {
            throw ValidationException::withMessages(['project_id' => 'Quotes can only be requested for an active project.']);
        }

        $request = DB::transaction(function () use ($project, $requester, $data) {
            $request = QuoteRequest::create([
                'project_id' => $project->id,
                'requested_by' => $requester->id,
                'title' => trim($data['title']),
                'notes' => $data['notes'] ?? null,
                'needed_by' => $data['needed_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                $request->items()->create([
                    'material_name' => trim($item['material_name']),
                    'unit' => trim($item['unit']),
                    'quantity' => (int) $item['quantity'],
                ]);
            }

            return $request;
        });

        $count = count($data['items']);
        User::where('role', 'supplier')->where('approval_status', 'approved')->each(
            fn (User $supplier) => $this->notifications->send(
                $supplier,
                'quote_request_received',
                'New quote request',
                "{$project->title} needs prices for {$count} ".($count === 1 ? 'item' : 'items').'. Place your bid.',
                ['quoteRequestId' => $request->id, 'projectTitle' => $project->title]
            )
        );

        return $this->presentForRequester($this->withRelations($request));
    }

    /**
     * Every quote request on the projects this homeowner owns or this contractor is assigned to.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listForRequester(User $user): array
    {
        $projectIds = Project::query()
            ->where(fn ($q) => $q->where('user_id', $user->id)->orWhereHas('contractors', fn ($c) => $c->whereKey($user->id)))
            ->pluck('id');

        return QuoteRequest::query()
            ->whereIn('project_id', $projectIds)
            ->with(['project:id,title,location', 'requester:id,name,role', 'items', 'bids.items', 'bids.supplier:id,name,business_name'])
            ->latest('id')
            ->get()
            ->map(fn (QuoteRequest $r) => $this->presentForRequester($r))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function award(QuoteRequest $request, User $acting, int $bidId): array
    {
        $this->assertManages($request, $acting);

        $awarded = DB::transaction(function () use ($request, $bidId) {
            $locked = QuoteRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            if (! $locked->isOpen()) {
                throw ValidationException::withMessages(['quote_request_id' => 'This quote request is no longer open.']);
            }

            $winner = $locked->bids()->whereKey($bidId)->where('status', QuoteBid::PENDING)->first();
            if (! $winner) {
                throw ValidationException::withMessages(['bid_id' => 'That bid is not available to award.']);
            }

            $losers = $locked->bids()->where('status', QuoteBid::PENDING)->whereKeyNot($winner->id)->get();

            $winner->update(['status' => QuoteBid::ACCEPTED]);
            $locked->bids()->whereKey($losers->modelKeys())->update(['status' => QuoteBid::REJECTED]);
            $locked->update(['status' => QuoteRequest::AWARDED, 'awarded_bid_id' => $winner->id]);

            return [$winner, $losers];
        });

        [$winner, $losers] = $awarded;
        $title = $request->title;
        $data = ['quoteRequestId' => $request->id, 'projectTitle' => $request->project->title];

        $this->notifications->send($winner->supplier, 'quote_bid_awarded', 'You won the bid', "Your quote for \"{$title}\" was chosen.", $data);
        foreach ($losers as $loser) {
            $this->notifications->send($loser->supplier, 'quote_bid_not_selected', 'Quote not selected', "Another supplier's quote for \"{$title}\" was chosen.", $data);
        }

        return $this->presentForRequester($this->withRelations($request));
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function cancel(QuoteRequest $request, User $acting): array
    {
        $this->assertManages($request, $acting);

        if (! $request->isOpen()) {
            throw ValidationException::withMessages(['quote_request_id' => 'Only an open quote request can be cancelled.']);
        }

        $request->update(['status' => QuoteRequest::CANCELLED]);

        $bidders = $request->bids()->where('status', QuoteBid::PENDING)->with('supplier')->get();
        foreach ($bidders as $bid) {
            $this->notifications->send(
                $bid->supplier,
                'quote_request_cancelled',
                'Quote request cancelled',
                "The request for \"{$request->title}\" was cancelled.",
                ['quoteRequestId' => $request->id, 'projectTitle' => $request->project->title]
            );
        }

        return $this->presentForRequester($this->withRelations($request));
    }

    /**
     * @throws ValidationException
     */
    private function assertManages(QuoteRequest $request, User $acting): void
    {
        if (! $request->project->canManageTeam($acting)) {
            throw ValidationException::withMessages(['quote_request_id' => 'You cannot manage this quote request.']);
        }
    }

    // ---- the supplier's side -------------------------------------------------------------------

    /**
     * Every open request, plus any the supplier has bid on that has since closed.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listForSupplier(User $supplier): array
    {
        return QuoteRequest::query()
            ->where(fn ($q) => $q->where('status', QuoteRequest::OPEN)->orWhereHas('bids', fn ($b) => $b->where('supplier_id', $supplier->id)))
            ->with(['project:id,title,location', 'items', 'bids' => fn ($b) => $b->where('supplier_id', $supplier->id)->with('items')])
            ->withCount(['bids' => fn ($b) => $b->where('status', '!=', QuoteBid::WITHDRAWN)])
            ->latest('id')
            ->get()
            ->map(fn (QuoteRequest $r) => $this->presentForSupplier($r))
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data  A validated SubmitQuoteBidRequest payload.
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function bid(QuoteRequest $request, User $supplier, array $data): array
    {
        if ($supplier->approval_status !== 'approved') {
            throw ValidationException::withMessages(['quote_request_id' => 'Your account must be approved before you can bid.']);
        }
        if (! $request->isOpen()) {
            throw ValidationException::withMessages(['quote_request_id' => 'This quote request is no longer taking bids.']);
        }

        $request->load('items');
        $rows = collect($data['items']);
        $wanted = $request->items->pluck('id')->sort()->values()->all();
        $priced = $rows->pluck('item_id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        if ($priced !== $wanted) {
            throw ValidationException::withMessages(['items' => 'Price every item on the request, once each.']);
        }

        $prices = $rows->mapWithKeys(fn ($row) => [(int) $row['item_id'] => (int) $row['unit_price']]);
        $total = $request->items->sum(fn ($item) => $item->quantity * $prices[$item->id]);

        $revising = false;
        DB::transaction(function () use ($request, $supplier, $data, $prices, $total, &$revising) {
            $existing = QuoteBid::where('quote_request_id', $request->id)->where('supplier_id', $supplier->id)->first();
            $revising = $existing !== null && $existing->status === QuoteBid::PENDING;

            $bid = QuoteBid::updateOrCreate(
                ['quote_request_id' => $request->id, 'supplier_id' => $supplier->id],
                ['total' => $total, 'delivery_days' => (int) $data['delivery_days'], 'note' => $data['note'] ?? null, 'status' => QuoteBid::PENDING]
            );

            $bid->items()->delete();
            foreach ($prices as $itemId => $unitPrice) {
                $bid->items()->create(['quote_request_item_id' => $itemId, 'unit_price' => $unitPrice]);
            }
        });

        $name = $supplier->business_name ?: $supplier->name;
        $this->notifications->send(
            $request->requester,
            'quote_bid_received',
            $revising ? 'Quote updated' : 'New quote received',
            "{$name} ".($revising ? 'updated their quote' : 'quoted')." for \"{$request->title}\".",
            ['quoteRequestId' => $request->id, 'projectTitle' => $request->project->title]
        );

        return $this->presentForSupplier($this->supplierView($request, $supplier));
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function withdraw(QuoteRequest $request, User $supplier): array
    {
        $bid = $request->bids()->where('supplier_id', $supplier->id)->where('status', QuoteBid::PENDING)->first();

        if (! $request->isOpen() || ! $bid) {
            throw ValidationException::withMessages(['quote_request_id' => 'You can only withdraw a pending bid on an open request.']);
        }

        $bid->update(['status' => QuoteBid::WITHDRAWN]);

        return $this->presentForSupplier($this->supplierView($request, $supplier));
    }

    private function supplierView(QuoteRequest $request, User $supplier): QuoteRequest
    {
        return QuoteRequest::query()
            ->whereKey($request->id)
            ->with(['project:id,title,location', 'items', 'bids' => fn ($b) => $b->where('supplier_id', $supplier->id)->with('items')])
            ->withCount(['bids' => fn ($b) => $b->where('status', '!=', QuoteBid::WITHDRAWN)])
            ->firstOrFail();
    }

    // ---- presentation --------------------------------------------------------------------------

    private function withRelations(QuoteRequest $request): QuoteRequest
    {
        return $request->fresh(['project:id,title,location', 'requester:id,name,role', 'items', 'bids.items', 'bids.supplier:id,name,business_name']);
    }

    /**
     * The request with every bid on it, cheapest first, for the people deciding.
     *
     * @return array<string, mixed>
     */
    private function presentForRequester(QuoteRequest $request): array
    {
        $quantities = $request->items->pluck('quantity', 'id');
        $live = $request->bids->where('status', '!=', QuoteBid::WITHDRAWN);
        $cheapest = $live->whereIn('status', [QuoteBid::PENDING, QuoteBid::ACCEPTED])->min('total');

        return [
            'id' => $request->id,
            'projectId' => $request->project_id,
            'projectTitle' => $request->project?->title,
            'location' => $request->project?->location,
            'title' => $request->title,
            'notes' => $request->notes,
            'neededBy' => $request->needed_by,
            'status' => $request->status,
            'awardedBidId' => $request->awarded_bid_id,
            'createdAt' => $request->created_at->toIso8601String(),
            'requestedBy' => ['id' => $request->requester?->id, 'name' => $request->requester?->name, 'role' => $request->requester?->role],
            'items' => $this->presentItems($request->items),
            'bids' => $live->sortBy('total')->values()->map(fn (QuoteBid $bid) => [
                'id' => $bid->id,
                'supplierId' => $bid->supplier_id,
                'supplierName' => $bid->supplier?->business_name ?: $bid->supplier?->name,
                'total' => (int) $bid->total,
                'deliveryDays' => (int) $bid->delivery_days,
                'note' => $bid->note,
                'status' => $bid->status,
                'isLowest' => in_array($bid->status, [QuoteBid::PENDING, QuoteBid::ACCEPTED], true) && (int) $bid->total === (int) $cheapest,
                'items' => $bid->items->map(fn ($line) => [
                    'itemId' => $line->quote_request_item_id,
                    'unitPrice' => (int) $line->unit_price,
                    'subtotal' => (int) $line->unit_price * (int) ($quantities[$line->quote_request_item_id] ?? 0),
                ])->values()->all(),
            ])->all(),
        ];
    }

    /**
     * The request as a supplier sees it: the materials wanted and only their own bid.
     *
     * @return array<string, mixed>
     */
    private function presentForSupplier(QuoteRequest $request): array
    {
        $mine = $request->bids->first();
        $mine = $mine && $mine->status !== QuoteBid::WITHDRAWN ? $mine : null;

        return [
            'id' => $request->id,
            'projectTitle' => $request->project?->title,
            'location' => $request->project?->location,
            'title' => $request->title,
            'notes' => $request->notes,
            'neededBy' => $request->needed_by,
            'status' => $request->status,
            'createdAt' => $request->created_at->toIso8601String(),
            'bidCount' => (int) ($request->bids_count ?? 0),
            'items' => $this->presentItems($request->items),
            'myBid' => $mine ? [
                'id' => $mine->id,
                'total' => (int) $mine->total,
                'deliveryDays' => (int) $mine->delivery_days,
                'note' => $mine->note,
                'status' => $mine->status,
                'items' => $mine->items->map(fn ($line) => ['itemId' => $line->quote_request_item_id, 'unitPrice' => (int) $line->unit_price])->values()->all(),
            ] : null,
        ];
    }

    /**
     * @param  Collection<int, QuoteRequestItem>  $items
     * @return array<int, array<string, mixed>>
     */
    private function presentItems(Collection $items): array
    {
        return $items->map(fn ($item) => [
            'id' => $item->id,
            'materialName' => $item->material_name,
            'unit' => $item->unit,
            'quantity' => $item->quantity,
        ])->values()->all();
    }
}
