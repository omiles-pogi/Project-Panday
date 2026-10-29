<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\MaterialRequestStatusLog;
use App\Models\SupplierOrder;
use App\Models\User;

/**
 * Low-level steps shared by MaterialRequestService (contractor/homeowner side) and
 * SupplierOrderService (supplier side): status logging, cancelling an order with its stock
 * reservation released, sending a request back for revision, and detecting completion.
 * Callers wrap these in a DB transaction.
 */
class MaterialWorkflow
{
    public function __construct(
        private readonly StockService $stock,
        private readonly NotificationService $notifications,
    ) {}

    public function setRequestStatus(MaterialRequest $request, string $status, ?User $by, ?string $reason = null): void
    {
        $previous = $request->status;
        $request->status = $status;
        $request->save();
        $this->log($request, null, $by, $previous, $status, $reason);
    }

    public function setOrderStatus(SupplierOrder $order, string $status, ?User $by, ?string $reason = null): void
    {
        $previous = $order->status;
        $order->status = $status;
        $order->save();
        $this->log($order->materialRequest, $order, $by, $previous, $status, $reason);
    }

    public function log(MaterialRequest $request, ?SupplierOrder $order, ?User $by, ?string $previous, string $new, ?string $reason): void
    {
        MaterialRequestStatusLog::create([
            'material_request_id' => $request->id,
            'supplier_order_id' => $order?->id,
            'changed_by' => $by?->id,
            'previous_status' => $previous,
            'new_status' => $new,
            'reason' => $reason,
        ]);
    }

    /** Releases every reservation the order's items hold. Idempotent: each item's hold is zeroed. */
    public function releaseReservations(SupplierOrder $order): void
    {
        foreach ($order->items()->where('reserved_quantity', '>', 0)->get() as $item) {
            if ($item->supplier_product_id) {
                $this->stock->release($item->supplier_product_id, $item->reserved_quantity);
            }
            $item->update(['reserved_quantity' => 0]);
        }
    }

    /** Cancels an order that hasn't been delivered yet, giving back any stock it reserved. */
    public function cancelOrder(SupplierOrder $order, ?User $by, ?string $reason): void
    {
        $this->releaseReservations($order);
        $order->items()->update(['status' => MaterialRequestItem::PENDING, 'confirmed_unit_price' => null]);
        $this->setOrderStatus($order, SupplierOrder::CANCELLED, $by, $reason);
    }

    /**
     * A supplier/price problem hands the request back to the contractor. Orders still in progress
     * for other suppliers are left alone; only the failed order's items become editable again.
     */
    public function returnForRevision(MaterialRequest $request, ?User $by, string $reason): void
    {
        $request->decision_reason = $reason;
        if ($request->status === MaterialRequest::REVISION) {
            $request->save();
            $this->log($request, null, $by, MaterialRequest::REVISION, MaterialRequest::REVISION, $reason);

            return;
        }
        if (in_array($request->status, [MaterialRequest::APPROVED, MaterialRequest::PENDING], true)) {
            $this->setRequestStatus($request, MaterialRequest::REVISION, $by, $reason);
        }
    }

    /**
     * Completed only when every item has been routed to a live order and every live order has been
     * received — a request with items still awaiting revision or delivery is never "done".
     */
    public function completeIfFulfilled(MaterialRequest $request, ?User $by): bool
    {
        if ($request->status !== MaterialRequest::APPROVED) {
            return false;
        }

        $request->load('items.order');
        if ($request->items->isEmpty() || $request->items->contains(fn (MaterialRequestItem $i) => $i->isEditable())) {
            return false;
        }

        $live = $request->orders()->whereNotIn('status', SupplierOrder::DEAD)->get();
        if ($live->isEmpty() || $live->contains(fn (SupplierOrder $o) => $o->status !== SupplierOrder::RECEIVED)) {
            return false;
        }

        $this->setRequestStatus($request, MaterialRequest::COMPLETED, $by);
        $this->notify($request->homeowner, 'material_request_completed', 'Materials complete', "All materials for {$request->project->title} have been received.", $request);
        $this->notify($request->contractor, 'material_request_completed', 'Materials complete', "Every material on request #{$request->id} has been received.", $request);

        return true;
    }

    /** @param  array<string, mixed>  $extra */
    public function notify(?User $recipient, string $type, string $title, string $body, MaterialRequest $request, array $extra = []): void
    {
        if (! $recipient) {
            return;
        }

        $this->notifications->send($recipient, $type, $title, $body, array_merge([
            'materialRequestId' => $request->id,
            'projectId' => $request->project_id,
            'projectTitle' => $request->project?->title,
        ], $extra));
    }
}
