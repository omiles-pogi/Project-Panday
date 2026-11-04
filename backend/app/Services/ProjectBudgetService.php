<?php

namespace App\Services;

use App\Models\MaterialRequestItem;
use App\Models\Project;
use App\Models\SupplierOrder;
use App\Models\SupplierProduct;
use App\Support\Wage;

class ProjectBudgetService
{
    /** Recorded order commitments, never inferred payments or progress-based spending. */
    public function recordsFor(Project $project): array
    {
        $orders = SupplierOrder::query()
            ->whereHas('materialRequest', fn ($query) => $query->where('project_id', $project->id))
            ->with(['supplier:id,name,business_name', 'items.product:id,category'])
            ->orderBy('id')->get();

        $confirmedStatuses = [SupplierOrder::CONFIRMED, SupplierOrder::PREPARING, SupplierOrder::FOR_DELIVERY, SupplierOrder::DELIVERED, SupplierOrder::RECEIVED];
        $lines = $orders->flatMap(function (SupplierOrder $order) use ($confirmedStatuses) {
            return $order->items->map(fn (MaterialRequestItem $item) => [
                'id' => $item->id,
                'orderId' => $order->id,
                'material' => $item->material_name,
                // A deleted listing has no known category; never guess one from its name.
                'category' => $item->product ? SupplierProduct::planCategoryFor($item->product->category) : null,
                'supplierName' => $order->supplier?->business_name ?: $order->supplier?->name,
                'status' => $order->status,
                'qty' => $item->quantity,
                'unit' => $item->unit,
                'unitPrice' => $item->confirmed_unit_price ?? $item->estimated_unit_price,
                'priceConfirmed' => $item->confirmed_unit_price !== null,
                'isCommitment' => in_array($order->status, $confirmedStatuses, true) && $item->confirmed_unit_price !== null,
                'total' => $item->quantity * ($item->confirmed_unit_price ?? $item->estimated_unit_price),
            ]);
        })->values();

        $wages = $project->workers->concat($project->contractors)
            ->map(fn ($member) => Wage::fromPivot($member->pivot))->filter();

        return [
            'agreedWageTotal' => $wages->where('auto', false)->sum('total'),
            'automaticWageTotal' => $wages->where('auto', true)->sum('total'),
            'confirmedMaterialTotal' => $lines->where('isCommitment', true)->sum('total'),
            'orderLines' => $lines->all(),
            // There is no payment ledger. Unknown must stay unknown, even at 100% progress.
            'paidTotal' => null,
        ];
    }
}
