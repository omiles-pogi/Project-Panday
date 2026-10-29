<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\Project;
use App\Models\SupplierOrder;
use App\Models\SupplierProduct;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Contractor ↔ homeowner side of the material workflow:
 *
 *   draft → pending_homeowner_approval → approved → completed
 *                 ↘ revision_requested ↗ (contractor edits + resubmits)
 *                 ↘ rejected            cancelled (either party, before any delivery)
 *
 * Approval splits the request into one SupplierOrder per supplier (see SupplierOrderService for
 * what suppliers do next). Every check here is against the real project relationship: only an
 * assigned contractor can build/submit, only the project's owner can decide.
 */
class MaterialRequestService
{
    private const PRESENT_WITH = [
        'project:id,title,location,user_id',
        'contractor:id,name',
        'homeowner:id,name',
        'items.product',
        'items.supplier:id,name,business_name',
        'items.order',
        'orders.supplier:id,name,business_name',
        'statusLogs.changedBy:id,name,role',
    ];

    public function __construct(private readonly MaterialWorkflow $workflow) {}

    /** @return Collection<int, array<string, mixed>> */
    public function listFor(User $user): Collection
    {
        $query = MaterialRequest::query()->with(self::PRESENT_WITH)->latest('updated_at')->latest('id');

        if ($user->role === 'contractor') {
            $query->where('contractor_id', $user->id);
        } else {
            // Drafts are the contractor's private work-in-progress.
            $query->where('homeowner_id', $user->id)->where('status', '!=', MaterialRequest::DRAFT);
        }

        return $query->get()->map(fn (MaterialRequest $r) => $this->present($r, $user));
    }

    /** @return array<string, mixed> */
    public function show(MaterialRequest $request, User $user): array
    {
        $this->authorizeViewer($request, $user);

        return $this->present($request->load(self::PRESENT_WITH), $user);
    }

    /** @return array<string, mixed> */
    public function create(User $contractor, Project $project, ?string $notes): array
    {
        $this->assertAssigned($project, $contractor);

        $request = DB::transaction(function () use ($contractor, $project, $notes) {
            $request = MaterialRequest::create([
                'project_id' => $project->id,
                'contractor_id' => $contractor->id,
                'homeowner_id' => $project->user_id,
                'status' => MaterialRequest::DRAFT,
                'notes' => $notes,
            ]);
            $this->workflow->log($request, null, $contractor, null, MaterialRequest::DRAFT, null);

            return $request;
        });

        return $this->present($request->load(self::PRESENT_WITH), $contractor);
    }

    /**
     * Replaces the editable part of the item list. Items already with a live supplier order are
     * locked and untouched; prices/names for listed items always come from the listing itself,
     * never from the client.
     *
     * @param  array{notes?: ?string, items: array<int, array<string, mixed>>}  $data
     * @return array<string, mixed>
     */
    public function update(MaterialRequest $request, User $contractor, array $data): array
    {
        $this->assertContractorCanEdit($request, $contractor);

        DB::transaction(function () use ($request, $data) {
            if (array_key_exists('notes', $data)) {
                $request->notes = $data['notes'];
            }

            $request->load('items.order');
            $editable = $request->items->filter(fn (MaterialRequestItem $i) => $i->isEditable())->keyBy('id');
            $locked = $request->items->reject(fn (MaterialRequestItem $i) => $i->isEditable())->keyBy('id');
            $kept = [];

            foreach ($data['items'] as $row) {
                $attributes = $this->itemAttributes($row);
                $id = $row['id'] ?? null;

                if ($id !== null) {
                    if ($locked->has($id)) {
                        throw ValidationException::withMessages(['items' => 'Materials already accepted by a supplier cannot be changed here.']);
                    }
                    $item = $editable->get($id);
                    if (! $item) {
                        throw ValidationException::withMessages(['items' => 'One of the materials no longer belongs to this request.']);
                    }
                    // A re-edited item from a declined/cancelled order starts over as unrouted.
                    $item->update($attributes + ['supplier_order_id' => null, 'confirmed_unit_price' => null, 'status' => MaterialRequestItem::PENDING]);
                    $kept[] = $item->id;
                } else {
                    $kept[] = $request->items()->create($attributes)->id;
                }
            }

            $request->items()->whereKey($editable->keys()->diff($kept)->all())->delete();
            $this->recalculateTotal($request);
            $request->save();
        });

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $contractor);
    }

    /** @return array<string, mixed> */
    public function submit(MaterialRequest $request, User $contractor): array
    {
        $this->assertContractorCanEdit($request, $contractor);

        DB::transaction(function () use ($request, $contractor) {
            $request->load('items.order', 'items.product');
            if ($request->items->isEmpty()) {
                throw ValidationException::withMessages(['items' => 'Add at least one material before submitting.']);
            }

            foreach ($request->items->filter(fn (MaterialRequestItem $i) => $i->isEditable()) as $item) {
                $listing = $item->supplier_product_id
                    ? SupplierProduct::query()->listed()->find($item->supplier_product_id)
                    : null;
                if (! $listing) {
                    throw ValidationException::withMessages([
                        'items' => "Choose an available supplier listing for “{$item->material_name}” before submitting.",
                    ]);
                }
                // The homeowner approves today's real listing price, not a stale snapshot.
                $item->update([
                    'supplier_id' => $listing->supplier_id,
                    'material_name' => $listing->name,
                    'unit' => $listing->unit,
                    'estimated_unit_price' => $listing->price,
                    'supplier_order_id' => null,
                    'confirmed_unit_price' => null,
                    'status' => MaterialRequestItem::PENDING,
                ]);
            }

            $this->recalculateTotal($request);
            $request->submitted_at = now();
            $request->decision_reason = null;
            $this->workflow->setRequestStatus($request, MaterialRequest::PENDING, $contractor);
        });

        $request->load('project');
        $this->workflow->notify($request->homeowner, 'material_request_submitted', 'Material request needs approval',
            "{$contractor->name} submitted a material request for {$request->project->title} (est. ₱".number_format($request->estimated_total).').', $request);

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $contractor);
    }

    /** Approves and routes each supplier's items to a new SupplierOrder for that supplier. */
    public function approve(MaterialRequest $request, User $homeowner): array
    {
        $this->assertHomeownerDecides($request, $homeowner);

        $orders = DB::transaction(function () use ($request, $homeowner) {
            $request->load('items.order');
            $routable = $request->items->filter(fn (MaterialRequestItem $i) => $i->isEditable());
            if ($routable->contains(fn (MaterialRequestItem $i) => ! $i->supplier_id)) {
                throw ValidationException::withMessages(['items' => 'Every material needs a supplier before approval.']);
            }

            $request->approved_at = now();
            $request->decision_reason = null;
            $this->workflow->setRequestStatus($request, MaterialRequest::APPROVED, $homeowner);

            $orders = collect();
            foreach ($routable->groupBy('supplier_id') as $supplierId => $items) {
                $order = SupplierOrder::create([
                    'material_request_id' => $request->id,
                    'supplier_id' => $supplierId,
                    'status' => SupplierOrder::SUPPLIER_REVIEW,
                ]);
                MaterialRequestItem::query()->whereKey($items->pluck('id'))->update([
                    'supplier_order_id' => $order->id,
                    'status' => MaterialRequestItem::PENDING,
                    'confirmed_unit_price' => null,
                ]);
                $this->workflow->log($request, $order, $homeowner, null, SupplierOrder::SUPPLIER_REVIEW, null);
                $orders->push($order);
            }

            return $orders;
        });

        $request->load('project', 'contractor');
        $this->workflow->notify($request->contractor, 'material_request_approved', 'Material request approved',
            "{$homeowner->name} approved your material request for {$request->project->title}. It has been sent to the supplier(s).", $request);
        foreach ($orders as $order) {
            $order->load('supplier');
            $this->workflow->notify($order->supplier, 'supplier_order_received', 'New material order',
                "A contractor's approved request for {$request->project->title} needs your availability check.", $request, ['supplierOrderId' => $order->id]);
        }

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $homeowner);
    }

    /** @return array<string, mixed> */
    public function requestRevision(MaterialRequest $request, User $homeowner, string $reason): array
    {
        $this->assertHomeownerDecides($request, $homeowner);

        DB::transaction(function () use ($request, $homeowner, $reason) {
            $request->decision_reason = $reason;
            $this->workflow->setRequestStatus($request, MaterialRequest::REVISION, $homeowner, $reason);
        });

        $this->workflow->notify($request->contractor, 'material_request_revision', 'Revision requested',
            "{$homeowner->name} asked for changes to your material request: {$reason}", $request->load('project'));

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $homeowner);
    }

    /** @return array<string, mixed> */
    public function reject(MaterialRequest $request, User $homeowner, string $reason): array
    {
        $this->assertHomeownerDecides($request, $homeowner);

        $cancelled = DB::transaction(function () use ($request, $homeowner, $reason) {
            $request->decision_reason = $reason;
            $this->workflow->setRequestStatus($request, MaterialRequest::REJECTED, $homeowner, $reason);

            return $this->cancelOpenOrders($request, $homeowner, 'Material request rejected by the homeowner.');
        });

        $request->load('project');
        $this->workflow->notify($request->contractor, 'material_request_rejected', 'Material request rejected',
            "{$homeowner->name} rejected your material request: {$reason}", $request);
        $this->notifySuppliersOfCancellation($cancelled, $request);

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $homeowner);
    }

    /** Either party may cancel until any supplier has delivered; open reservations are released. */
    public function cancel(MaterialRequest $request, User $user, ?string $reason): array
    {
        $this->authorizeViewer($request, $user);
        if ($user->role === 'homeowner' && $request->status === MaterialRequest::DRAFT) {
            throw ValidationException::withMessages(['status' => 'This request is still a draft.']);
        }
        if (in_array($request->status, MaterialRequest::CLOSED, true)) {
            throw ValidationException::withMessages(['status' => 'This request is already closed.']);
        }
        if ($request->orders()->whereIn('status', [SupplierOrder::DELIVERED, SupplierOrder::RECEIVED])->exists()) {
            throw ValidationException::withMessages(['status' => 'Some materials were already delivered, so this request can no longer be cancelled.']);
        }

        $cancelled = DB::transaction(function () use ($request, $user, $reason) {
            $request->decision_reason = $reason;
            $this->workflow->setRequestStatus($request, MaterialRequest::CANCELLED, $user, $reason);

            return $this->cancelOpenOrders($request, $user, $reason ?? 'Material request cancelled.');
        });

        $request->load('project', 'contractor', 'homeowner');
        $other = $user->id === $request->contractor_id ? $request->homeowner : $request->contractor;
        if ($request->submitted_at) {
            $this->workflow->notify($other, 'material_request_cancelled', 'Material request cancelled',
                "{$user->name} cancelled the material request for {$request->project->title}.".($reason ? " Reason: {$reason}" : ''), $request);
        }
        $this->notifySuppliersOfCancellation($cancelled, $request);

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $user);
    }

    /** Homeowner accepts a supplier's changed final prices. */
    public function confirmOrderPrices(SupplierOrder $order, User $homeowner): array
    {
        $request = $order->materialRequest;
        $this->assertHomeownerOwns($request, $homeowner);

        DB::transaction(function () use ($order, $homeowner) {
            $order = SupplierOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status !== SupplierOrder::AWAITING_HOMEOWNER) {
                throw ValidationException::withMessages(['status' => 'This order is not waiting for your price confirmation.']);
            }
            $this->workflow->setOrderStatus($order, SupplierOrder::CONFIRMED, $homeowner, 'Final prices accepted by the homeowner.');
        });

        $order->load('supplier');
        $request->load('project', 'contractor');
        $this->workflow->notify($order->supplier, 'supplier_order_confirmed', 'Order confirmed', "The homeowner accepted your final prices for {$request->project->title}. You can start preparing.", $request, ['supplierOrderId' => $order->id]);
        $this->workflow->notify($request->contractor, 'supplier_order_confirmed', 'Supplier prices accepted', "{$homeowner->name} accepted the supplier's final prices for request #{$request->id}.", $request);

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $homeowner);
    }

    /** Homeowner refuses changed prices: the order is cancelled (stock released) and returns to the contractor. */
    public function declineOrderPrices(SupplierOrder $order, User $homeowner, string $reason): array
    {
        $request = $order->materialRequest;
        $this->assertHomeownerOwns($request, $homeowner);

        DB::transaction(function () use ($order, $request, $homeowner, $reason) {
            $order = SupplierOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status !== SupplierOrder::AWAITING_HOMEOWNER) {
                throw ValidationException::withMessages(['status' => 'This order is not waiting for your price confirmation.']);
            }
            $this->workflow->cancelOrder($order, $homeowner, "Final prices declined: {$reason}");
            $this->workflow->returnForRevision($request, $homeowner, "Homeowner declined a supplier's final prices: {$reason}");
        });

        $order->load('supplier');
        $request->load('project', 'contractor');
        $this->workflow->notify($order->supplier, 'supplier_order_cancelled', 'Order cancelled', "The homeowner declined your final prices for {$request->project->title}.", $request, ['supplierOrderId' => $order->id]);
        $this->workflow->notify($request->contractor, 'material_request_revision', 'Choose another supplier', "{$homeowner->name} declined a supplier's final prices: {$reason}", $request);

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $homeowner);
    }

    /** Contractor confirms a delivered order actually arrived. */
    public function receive(SupplierOrder $order, User $contractor): array
    {
        $request = $order->materialRequest;
        if ($request->contractor_id !== $contractor->id) {
            throw ValidationException::withMessages(['material_request_id' => 'This is not your material request.']);
        }

        DB::transaction(function () use ($order, $request, $contractor) {
            $order = SupplierOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status !== SupplierOrder::DELIVERED) {
                throw ValidationException::withMessages(['status' => 'Only delivered orders can be marked as received.']);
            }
            $order->received_at = now();
            $this->workflow->setOrderStatus($order, SupplierOrder::RECEIVED, $contractor);
            $this->workflow->completeIfFulfilled($request->fresh(), $contractor);
        });

        $order->load('supplier');
        $request->load('project', 'homeowner');
        $this->workflow->notify($request->homeowner, 'supplier_order_received_by_contractor', 'Materials received', "{$contractor->name} confirmed receipt of materials from ".($order->supplier->business_name ?: $order->supplier->name).'.', $request);
        $this->workflow->notify($order->supplier, 'supplier_order_received_by_contractor', 'Delivery received', "The contractor confirmed receipt of your delivery for {$request->project->title}.", $request, ['supplierOrderId' => $order->id]);

        return $this->present($request->fresh()->load(self::PRESENT_WITH), $contractor);
    }

    /**
     * The AI plan's suggested materials for this project, each matched to the cheapest listing
     * whose name is the same (case/space-insensitive) — only exact matches count as reliable.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function aiSuggestions(Project $project, User $user): Collection
    {
        $project->loadMissing('contractors:id');
        if (! $project->isOwnedBy($user) && ! $project->hasAssignedContractor($user)) {
            throw ValidationException::withMessages(['project_id' => 'You are not part of this project.']);
        }

        $listings = SupplierProduct::query()->listed()->with('supplier:id,name,business_name')->orderBy('price')->get()
            ->groupBy(fn (SupplierProduct $p) => $this->normalize($p->name));

        return collect($project->ai_materials ?? [])->map(function (array $m) use ($listings) {
            $candidates = $listings->get($this->normalize($m['material'] ?? '')) ?? collect();
            $match = $candidates->first(fn (SupplierProduct $p) => $p->available_quantity > 0) ?? $candidates->first();

            return [
                'material' => $m['material'] ?? '',
                'category' => $m['category'] ?? null,
                'quantity' => max(1, (int) ceil((float) ($m['qty'] ?? 1))),
                'unit' => $m['unit'] ?? 'piece',
                'estimatedUnitPrice' => (int) round((float) ($m['unitPrice'] ?? 0)),
                'match' => $match ? $this->presentListing($match) : null,
            ];
        })->values();
    }

    /** @return Collection<int, SupplierOrder> orders that were open and are now cancelled */
    private function cancelOpenOrders(MaterialRequest $request, User $by, string $reason): Collection
    {
        $open = $request->orders()
            ->whereNotIn('status', [...SupplierOrder::DEAD, SupplierOrder::DELIVERED, SupplierOrder::RECEIVED])
            ->lockForUpdate()
            ->get();
        foreach ($open as $order) {
            $this->workflow->cancelOrder($order, $by, $reason);
        }

        return $open;
    }

    /** @param  Collection<int, SupplierOrder>  $orders */
    private function notifySuppliersOfCancellation(Collection $orders, MaterialRequest $request): void
    {
        foreach ($orders as $order) {
            $order->load('supplier');
            $this->workflow->notify($order->supplier, 'supplier_order_cancelled', 'Order cancelled',
                "The material order for {$request->project->title} was cancelled. Any stock you reserved has been released.", $request, ['supplierOrderId' => $order->id]);
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function itemAttributes(array $row): array
    {
        $productId = $row['supplier_product_id'] ?? null;

        if ($productId) {
            $listing = SupplierProduct::query()->listed()->find($productId);
            if (! $listing) {
                throw ValidationException::withMessages(['items' => 'One of the selected supplier materials is no longer available.']);
            }

            return [
                'supplier_product_id' => $listing->id,
                'supplier_id' => $listing->supplier_id,
                'material_name' => $listing->name,
                'unit' => $listing->unit,
                'estimated_unit_price' => $listing->price,
                'quantity' => (int) $row['quantity'],
                'source' => $row['source'] ?? 'manual',
            ];
        }

        // Unmatched line (typically AI-imported): a placeholder estimate until a listing is chosen.
        return [
            'supplier_product_id' => null,
            'supplier_id' => null,
            'material_name' => $row['material_name'],
            'unit' => $row['unit'],
            'estimated_unit_price' => (int) ($row['estimated_unit_price'] ?? 0),
            'quantity' => (int) $row['quantity'],
            'source' => $row['source'] ?? 'manual',
        ];
    }

    private function recalculateTotal(MaterialRequest $request): void
    {
        $request->estimated_total = (int) $request->items()->sum(DB::raw('quantity * estimated_unit_price'));
    }

    private function normalize(string $name): string
    {
        return mb_strtolower(preg_replace('/\s+/', ' ', trim($name)) ?? '');
    }

    private function assertAssigned(Project $project, User $contractor): void
    {
        $project->loadMissing('contractors:id');
        if (! $project->hasAssignedContractor($contractor)) {
            throw ValidationException::withMessages(['project_id' => 'You are not assigned to this project.']);
        }
    }

    private function assertContractorCanEdit(MaterialRequest $request, User $contractor): void
    {
        if ($request->contractor_id !== $contractor->id) {
            throw ValidationException::withMessages(['material_request_id' => 'This is not your material request.']);
        }
        $this->assertAssigned($request->project, $contractor);
        if (! $request->isEditable()) {
            throw ValidationException::withMessages(['status' => 'This request can only be changed while it is a draft or awaiting revision.']);
        }
    }

    private function assertHomeownerOwns(MaterialRequest $request, User $homeowner): void
    {
        if ($request->homeowner_id !== $homeowner->id || $request->project?->user_id !== $homeowner->id) {
            throw ValidationException::withMessages(['material_request_id' => 'This is not a request for your project.']);
        }
    }

    private function assertHomeownerDecides(MaterialRequest $request, User $homeowner): void
    {
        $this->assertHomeownerOwns($request, $homeowner);
        if ($request->status !== MaterialRequest::PENDING) {
            throw ValidationException::withMessages(['status' => 'This request is not waiting for your approval.']);
        }
    }

    private function authorizeViewer(MaterialRequest $request, User $user): void
    {
        $allowed = $request->contractor_id === $user->id
            || ($request->homeowner_id === $user->id && $request->status !== MaterialRequest::DRAFT);
        if (! $allowed) {
            throw ValidationException::withMessages(['material_request_id' => 'This material request is not yours.']);
        }
    }

    /** @return array<string, mixed> */
    private function presentListing(SupplierProduct $p): array
    {
        return [
            'supplierProductId' => $p->id,
            'name' => $p->name,
            'unit' => $p->unit,
            'price' => $p->price,
            'availableQuantity' => $p->available_quantity,
            'stockStatus' => $p->stock_status,
            'supplierId' => $p->supplier_id,
            'supplierName' => $p->supplier ? ($p->supplier->business_name ?: $p->supplier->name) : null,
        ];
    }

    /** @return array<string, mixed> */
    public function present(MaterialRequest $r, User $viewer): array
    {
        $items = $r->items->map(function (MaterialRequestItem $i) {
            $available = $i->product?->available_quantity;

            return [
                'id' => $i->id,
                'supplierProductId' => $i->supplier_product_id,
                'supplierId' => $i->supplier_id,
                'supplierName' => $i->supplier ? ($i->supplier->business_name ?: $i->supplier->name) : null,
                'materialName' => $i->material_name,
                'unit' => $i->unit,
                'quantity' => $i->quantity,
                'estimatedUnitPrice' => $i->estimated_unit_price,
                'estimatedSubtotal' => $i->quantity * $i->estimated_unit_price,
                'confirmedUnitPrice' => $i->confirmed_unit_price,
                'confirmedSubtotal' => $i->confirmed_unit_price !== null ? $i->quantity * $i->confirmed_unit_price : null,
                'status' => $i->status,
                'source' => $i->source,
                'orderId' => $i->supplier_order_id,
                'locked' => ! $i->isEditable(),
                'availableQuantity' => $available,
                'stockStatus' => $i->product?->stock_status,
                'listingActive' => (bool) $i->product?->is_active,
                // Only meaningful before a supplier has reserved the units for this item.
                'insufficientStock' => $i->isEditable() && $available !== null && $i->quantity > $available,
            ];
        })->values();

        $orders = $r->orders->map(function (SupplierOrder $o) use ($r) {
            $orderItems = $r->items->where('supplier_order_id', $o->id);

            return [
                'id' => $o->id,
                'supplierId' => $o->supplier_id,
                'supplierName' => $o->supplier ? ($o->supplier->business_name ?: $o->supplier->name) : null,
                'status' => $o->status,
                'expectedDeliveryDate' => $o->expected_delivery_date?->toDateString(),
                'supplierNote' => $o->supplier_note,
                'declineReason' => $o->decline_reason,
                'priceChanged' => $orderItems->contains(fn (MaterialRequestItem $i) => $i->confirmed_unit_price !== null && $i->confirmed_unit_price !== $i->estimated_unit_price),
                'confirmedTotal' => $orderItems->sum(fn (MaterialRequestItem $i) => $i->quantity * ($i->confirmed_unit_price ?? 0)),
                'itemIds' => $orderItems->pluck('id')->values(),
                'confirmedAt' => $o->confirmed_at?->toIso8601String(),
                'deliveredAt' => $o->delivered_at?->toIso8601String(),
                'receivedAt' => $o->received_at?->toIso8601String(),
            ];
        })->values();

        $confirmed = $r->items->filter(fn (MaterialRequestItem $i) => $i->confirmed_unit_price !== null && $i->order && ! $i->order->isDead());

        return [
            'id' => $r->id,
            'status' => $r->status,
            'project' => ['id' => $r->project->id, 'title' => $r->project->title, 'location' => $r->project->location],
            'contractor' => ['id' => $r->contractor->id, 'name' => $r->contractor->name],
            'homeowner' => ['id' => $r->homeowner->id, 'name' => $r->homeowner->name],
            'notes' => $r->notes,
            'decisionReason' => $r->decision_reason,
            'estimatedTotal' => $r->estimated_total,
            'confirmedTotal' => $confirmed->sum(fn (MaterialRequestItem $i) => $i->quantity * $i->confirmed_unit_price),
            'submittedAt' => $r->submitted_at?->toIso8601String(),
            'approvedAt' => $r->approved_at?->toIso8601String(),
            'createdAt' => $r->created_at->toIso8601String(),
            'updatedAt' => $r->updated_at->toIso8601String(),
            'canEdit' => $viewer->id === $r->contractor_id && $r->isEditable(),
            'canDecide' => $viewer->id === $r->homeowner_id && $r->status === MaterialRequest::PENDING,
            'items' => $items,
            'orders' => $orders,
            'history' => $r->statusLogs->map(fn ($log) => [
                'id' => $log->id,
                'orderId' => $log->supplier_order_id,
                'previousStatus' => $log->previous_status,
                'newStatus' => $log->new_status,
                'reason' => $log->reason,
                'by' => $log->changedBy?->name,
                'byRole' => $log->changedBy?->role,
                'at' => $log->created_at?->toIso8601String(),
            ])->values(),
        ];
    }
}
