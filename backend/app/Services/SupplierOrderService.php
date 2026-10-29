<?php

namespace App\Services;

use App\Models\MaterialRequestItem;
use App\Models\SupplierOrder;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Supplier side of the material workflow. A supplier only ever sees and acts on their own
 * SupplierOrders — never another supplier's items on the same request, nor the homeowner chat.
 *
 *   supplier_review → (confirm) confirmed | awaiting_homeowner_confirmation (price changed)
 *                   → (insufficient / decline) unavailable → request returns for revision
 *   confirmed → preparing → for_delivery → delivered → (contractor) received
 *
 * Stock is reserved at confirm and deducted at delivered — exactly once each (see StockService).
 */
class SupplierOrderService
{
    private const PRESENT_WITH = [
        'materialRequest:id,project_id,contractor_id,approved_at,notes',
        'materialRequest.project:id,title,location',
        'materialRequest.contractor:id,name',
        'items.product',
    ];

    public function __construct(
        private readonly MaterialWorkflow $workflow,
        private readonly StockService $stock,
    ) {}

    /** @return Collection<int, array<string, mixed>> */
    public function listFor(User $supplier): Collection
    {
        return SupplierOrder::query()
            ->where('supplier_id', $supplier->id)
            ->with(self::PRESENT_WITH)
            ->latest('updated_at')
            ->latest('id')
            ->get()
            ->map(fn (SupplierOrder $o) => $this->present($o));
    }

    /** @return array<string, mixed> */
    public function show(SupplierOrder $order, User $supplier): array
    {
        $this->authorizeSupplier($order, $supplier);

        return $this->present($order->load(self::PRESENT_WITH));
    }

    /**
     * Confirms the full requested quantity of every item at the supplier's final unit price,
     * reserving that stock. All-or-nothing: if any item can't be covered, nothing is reserved.
     *
     * @param  array<int, int>  $prices  item id => final unit price (missing → current estimate)
     * @return array<string, mixed>
     */
    public function confirm(SupplierOrder $order, User $supplier, array $prices, ?string $expectedDate, ?string $note): array
    {
        $this->authorizeSupplier($order, $supplier);

        $priceChanged = DB::transaction(function () use ($order, $supplier, $prices, $expectedDate, $note) {
            $order = $this->lockInStatus($order, SupplierOrder::SUPPLIER_REVIEW, 'This order has already been reviewed.');
            $items = $order->items()->with('product')->get();

            $unknown = array_diff(array_keys($prices), $items->pluck('id')->all());
            if ($unknown) {
                throw ValidationException::withMessages(['items' => 'Some prices refer to materials that are not part of this order.']);
            }

            $changed = false;
            foreach ($items as $item) {
                if (! $item->supplier_product_id || ! $item->product) {
                    throw ValidationException::withMessages(['items' => "“{$item->material_name}” is no longer in your inventory. Report it as unavailable instead."]);
                }
                if (! $this->stock->reserve($item->supplier_product_id, $item->quantity)) {
                    throw ValidationException::withMessages([
                        'items' => "Not enough stock for “{$item->material_name}”: {$item->quantity} {$item->unit} requested, {$item->product->fresh()->available_quantity} available. Update your stock or report insufficient stock.",
                    ]);
                }
                $finalPrice = (int) ($prices[$item->id] ?? $item->estimated_unit_price);
                $changed = $changed || $finalPrice !== $item->estimated_unit_price;
                $item->update([
                    'confirmed_unit_price' => $finalPrice,
                    'reserved_quantity' => $item->quantity,
                    'status' => MaterialRequestItem::CONFIRMED,
                ]);
            }

            $order->expected_delivery_date = $expectedDate;
            $order->supplier_note = $note;
            $order->confirmed_at = now();
            $this->workflow->setOrderStatus(
                $order,
                $changed ? SupplierOrder::AWAITING_HOMEOWNER : SupplierOrder::CONFIRMED,
                $supplier,
                $changed ? 'Final prices differ from the estimate — homeowner confirmation required.' : null,
            );

            return $changed;
        });

        $request = $order->materialRequest()->with('project', 'contractor', 'homeowner')->first();
        $who = $supplier->business_name ?: $supplier->name;
        $body = $priceChanged
            ? "{$who} confirmed availability for {$request->project->title} with updated prices. Please review the final cost."
            : "{$who} confirmed availability and pricing for {$request->project->title}.";
        $this->workflow->notify($request->homeowner, $priceChanged ? 'supplier_price_confirmation' : 'supplier_order_confirmed',
            $priceChanged ? 'Confirm final material prices' : 'Supplier confirmed materials', $body, $request);
        $this->workflow->notify($request->contractor, 'supplier_order_confirmed', 'Supplier confirmed materials', $body, $request);

        return $this->present($order->fresh()->load(self::PRESENT_WITH));
    }

    /**
     * Supplier can't cover the order (some item exceeds available stock) or declines it outright.
     * Nothing is reserved; the items go back to the contractor to revise or re-source.
     *
     * @return array<string, mixed>
     */
    public function reportUnavailable(SupplierOrder $order, User $supplier, bool $decline, ?string $reason): array
    {
        $this->authorizeSupplier($order, $supplier);
        if ($decline && ! $reason) {
            throw ValidationException::withMessages(['reason' => 'Give a reason for declining.']);
        }

        $summary = DB::transaction(function () use ($order, $supplier, $decline, $reason) {
            $order = $this->lockInStatus($order, SupplierOrder::SUPPLIER_REVIEW, 'This order has already been reviewed.');
            $short = [];

            foreach ($order->items()->with('product')->get() as $item) {
                $available = $item->product?->available_quantity ?? 0;
                $isShort = $item->quantity > $available;
                if ($isShort) {
                    $short[] = "{$item->material_name} ({$item->quantity} requested, {$available} available)";
                }
                $item->update([
                    'status' => $decline ? MaterialRequestItem::UNAVAILABLE : ($isShort ? MaterialRequestItem::INSUFFICIENT : MaterialRequestItem::PENDING),
                ]);
            }

            if (! $decline && ! $short) {
                throw ValidationException::withMessages(['items' => 'You have enough stock for every item — confirm the order instead.']);
            }

            $who = $supplier->business_name ?: $supplier->name;
            $summary = $decline
                ? "{$who} declined the order: {$reason}"
                : "{$who} has insufficient stock for ".implode(', ', $short).($reason ? ". Note: {$reason}" : '.');

            $order->decline_reason = $reason ?? implode('; ', $short);
            $this->workflow->setOrderStatus($order, SupplierOrder::UNAVAILABLE, $supplier, $summary);
            $this->workflow->returnForRevision($order->materialRequest, $supplier, $summary);

            return $summary;
        });

        $request = $order->materialRequest()->with('project', 'contractor', 'homeowner')->first();
        $title = $decline ? 'Supplier declined materials' : 'Insufficient supplier stock';
        $this->workflow->notify($request->contractor, 'supplier_order_unavailable', $title, "{$summary} Please revise the request or choose another supplier.", $request);
        $this->workflow->notify($request->homeowner, 'supplier_order_unavailable', $title, $summary, $request);

        return $this->present($order->fresh()->load(self::PRESENT_WITH));
    }

    /**
     * Moves a confirmed order forward one step. Delivery deducts the reserved units from on-hand
     * stock; the status check under row lock means a repeated tap can never deduct twice.
     *
     * @return array<string, mixed>
     */
    public function advance(SupplierOrder $order, User $supplier, string $status): array
    {
        $this->authorizeSupplier($order, $supplier);

        DB::transaction(function () use ($order, $supplier, $status) {
            $order = SupplierOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ((SupplierOrder::SUPPLIER_TRANSITIONS[$order->status] ?? null) !== $status) {
                throw ValidationException::withMessages(['status' => $order->status === SupplierOrder::AWAITING_HOMEOWNER
                    ? 'Wait for the homeowner to accept your final prices first.'
                    : "An order that is {$order->status} cannot move to {$status}."]);
            }

            if ($status === SupplierOrder::DELIVERED) {
                foreach ($order->items as $item) {
                    if ($item->reserved_quantity > 0 && ! $this->stock->deduct($item->supplier_product_id, $item->reserved_quantity)) {
                        throw ValidationException::withMessages(['items' => "Stock for “{$item->material_name}” no longer matches its reservation — check that listing's quantity."]);
                    }
                    $item->update(['reserved_quantity' => 0]);
                }
                $order->delivered_at = now();
            }

            $this->workflow->setOrderStatus($order, $status, $supplier);
        });

        $request = $order->materialRequest()->with('project', 'contractor', 'homeowner')->first();
        $label = ['preparing' => 'is preparing', 'for_delivery' => 'is out for delivery with', 'delivered' => 'has delivered'][$status];
        $who = $supplier->business_name ?: $supplier->name;
        $body = "{$who} {$label} your materials for {$request->project->title}.".($status === SupplierOrder::DELIVERED ? ' Please confirm receipt.' : '');
        $this->workflow->notify($request->contractor, 'supplier_order_status', 'Material delivery update', $body, $request);
        $this->workflow->notify($request->homeowner, 'supplier_order_status', 'Material delivery update', $body, $request);

        return $this->present($order->fresh()->load(self::PRESENT_WITH));
    }

    private function lockInStatus(SupplierOrder $order, string $status, string $message): SupplierOrder
    {
        $locked = SupplierOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
        if ($locked->status !== $status) {
            throw ValidationException::withMessages(['status' => $message]);
        }

        return $locked;
    }

    private function authorizeSupplier(SupplierOrder $order, User $supplier): void
    {
        if ($order->supplier_id !== $supplier->id) {
            throw ValidationException::withMessages(['supplier_order_id' => 'This order is not yours.']);
        }
    }

    /**
     * Only what the supplier needs to fulfil: project reference/location for delivery, the
     * contractor as contact, and their own items. No homeowner details, no other suppliers.
     *
     * @return array<string, mixed>
     */
    public function present(SupplierOrder $o): array
    {
        $request = $o->materialRequest;
        $items = $o->items->map(fn (MaterialRequestItem $i) => [
            'id' => $i->id,
            'supplierProductId' => $i->supplier_product_id,
            'materialName' => $i->material_name,
            'unit' => $i->unit,
            'quantity' => $i->quantity,
            'estimatedUnitPrice' => $i->estimated_unit_price,
            'confirmedUnitPrice' => $i->confirmed_unit_price,
            'currentListingPrice' => $i->product?->price,
            'onHand' => $i->product?->stock,
            'reserved' => $i->product?->reserved,
            'availableQuantity' => $i->product?->available_quantity,
            'stockStatus' => $i->product?->stock_status,
            // Before confirming, can the supplier cover this line from available-to-promise stock?
            'insufficientStock' => $o->status === SupplierOrder::SUPPLIER_REVIEW && $i->quantity > ($i->product?->available_quantity ?? 0),
            'status' => $i->status,
        ])->values();

        return [
            'id' => $o->id,
            'materialRequestId' => $o->material_request_id,
            'status' => $o->status,
            'project' => $request?->project ? ['id' => $request->project->id, 'title' => $request->project->title, 'location' => $request->project->location] : null,
            'contractorName' => $request?->contractor?->name,
            'requestNotes' => $request?->notes,
            'requestDate' => ($request?->approved_at ?? $o->created_at)->toIso8601String(),
            'expectedDeliveryDate' => $o->expected_delivery_date?->toDateString(),
            'supplierNote' => $o->supplier_note,
            'declineReason' => $o->decline_reason,
            'estimatedTotal' => $items->sum(fn ($i) => $i['quantity'] * $i['estimatedUnitPrice']),
            'confirmedTotal' => $items->sum(fn ($i) => $i['quantity'] * ($i['confirmedUnitPrice'] ?? 0)),
            'confirmedAt' => $o->confirmed_at?->toIso8601String(),
            'deliveredAt' => $o->delivered_at?->toIso8601String(),
            'receivedAt' => $o->received_at?->toIso8601String(),
            'items' => $items,
        ];
    }
}
