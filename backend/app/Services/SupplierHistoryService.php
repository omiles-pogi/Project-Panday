<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\SupplierFulfillment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/** Read-only receipt history. Confirmation/reservation alone does not prove materials were supplied. */
class SupplierHistoryService
{
    private function receipts(User $supplier, ?int $projectId = null): Collection
    {
        abort_unless($supplier->role === 'supplier', 403);

        return SupplierFulfillment::query()
            ->where('supplier_id', $supplier->id)->where('status', SupplierFulfillment::RECEIVED)
            ->whereHas('materialRequest', function (Builder $query) use ($projectId) {
                // A different supplier can return the request for revision after this receipt.
                $query->whereIn('status', [MaterialRequest::APPROVED, MaterialRequest::COMPLETED, MaterialRequest::REVISION])
                    ->when($projectId !== null, fn (Builder $q) => $q->where('project_id', $projectId))
                    ->whereHas('project.user', fn (Builder $q) => $q->where('role', 'homeowner'));
            })
            ->whereHas('items', fn (Builder $query) => $query->where('supplier_id', $supplier->id)
                ->where('status', MaterialRequestItem::CONFIRMED)->where('quantity', '>', 0)
                ->whereColumn('material_request_items.material_request_id', 'supplier_fulfillments.material_request_id'))
            ->with([
                'materialRequest:id,project_id',
                'materialRequest.project:id,user_id,title,location,approved_plan',
                'materialRequest.project.user:id,name',
                'items' => fn ($query) => $query->where('supplier_id', $supplier->id)
                    ->where('status', MaterialRequestItem::CONFIRMED)->where('quantity', '>', 0),
            ])
            ->orderByDesc('received_at')->orderByDesc('id')->get();
    }

    public function listFor(User $supplier): Collection
    {
        return $this->receipts($supplier)->groupBy('materialRequest.project_id')
            ->map(fn (Collection $receipts) => $this->present($receipts, false))
            ->sortByDesc(fn (array $project) => $project['lastReceivedAt'] ?? '')->values();
    }

    public function detailsFor(User $supplier, int $projectId): array
    {
        // Scope by supplier participation before returning any homeowner/project information.
        $receipts = $this->receipts($supplier, $projectId);
        abort_if($receipts->isEmpty(), 404);

        return $this->present($receipts, true);
    }

    private function present(Collection $receipts, bool $details): array
    {
        $project = $receipts->first()->materialRequest->project;
        $lines = $receipts->flatMap(function (SupplierFulfillment $receipt) {
            return $receipt->items->where('material_request_id', $receipt->material_request_id)
                ->map(fn (MaterialRequestItem $item) => [
                    'id' => $item->id, 'fulfillmentId' => $receipt->id,
                    'materialRequestId' => $receipt->material_request_id,
                    'receivedAt' => $receipt->received_at?->toIso8601String(),
                    'fulfillmentStatus' => $receipt->status, 'itemStatus' => $item->status,
                    'name' => $item->material_name, 'quantity' => $item->quantity, 'unit' => $item->unit,
                    // Never read live inventory prices or substitute an estimate for an unknown final price.
                    'unitPrice' => $item->confirmed_unit_price,
                    'lineTotal' => $item->confirmed_unit_price === null ? null : $item->quantity * $item->confirmed_unit_price,
                ]);
        })->values();
        $missingPrices = $lines->whereNull('lineTotal')->count();
        $summary = [
            'id' => $project->id, 'title' => trim($project->title ?? '') ?: "Project #{$project->id}",
            'homeownerName' => $project->user->name,
            // Orders are newest first; missing legacy receipt dates are never replaced with today's date.
            'lastReceivedAt' => $receipts->firstWhere('received_at', '!=', null)?->received_at?->toIso8601String(),
            'receiptCount' => $receipts->count(), 'lineCount' => $lines->count(),
            'totalAmount' => $missingPrices > 0 ? null : $lines->sum('lineTotal'),
            'knownSubtotal' => $lines->sum('lineTotal'), 'missingPriceCount' => $missingPrices,
        ];
        if (! $details) {
            return $summary;
        }
        $floors = $project->approved_plan['floors'] ?? null;

        return $summary + [
            'projectType' => is_numeric($floors) && $floors > 0 ? ((int) $floors).'-storey house' : null,
            'location' => $project->location,
            // Each historical line stays separate, even when another receipt repeats the same material.
            'items' => $lines,
        ];
    }
}
