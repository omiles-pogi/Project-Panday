<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\Project;
use App\Models\SupplierProduct;
use App\Support\PlanMaterials;
use Illuminate\Support\Collection;

/**
 * Approval by exception. A submitted material request approves itself only when it stays inside what
 * the homeowner already approved — the plan's materials, within the plan's budget for each category,
 * from the supplier they chose, and in stock. Anything outside that is flagged with a plain reason and
 * waits for the homeowner, who then only has to look at the exceptions.
 *
 * The homeowner can switch it off per project (projects.auto_approve_materials), and it never applies
 * to a project whose approved plan has no budget to check against.
 */
class MaterialApprovalPolicy
{
    /**
     * @return array{auto: bool, flags: array<int, string>}
     */
    public function evaluate(MaterialRequest $request): array
    {
        $project = $request->project;

        // The homeowner opted out: every request waits for them, and there is nothing to explain.
        if (! $project->auto_approve_materials) {
            return ['auto' => false, 'flags' => []];
        }

        $request->loadMissing('items.product');
        $budgets = $this->budgets($project);
        if ($budgets->isEmpty()) {
            return ['auto' => false, 'flags' => ['This project has no approved plan budget to check the request against.']];
        }

        $selections = $project->approved_plan['supplierSelections'] ?? [];
        $flags = [];
        $requested = [];

        foreach ($request->items as $item) {
            $name = $item->material_name;
            $category = $item->product ? SupplierProduct::planCategoryFor($item->product->category) : null;

            if ($item->plan_quantity === null) {
                $flags[] = "“{$name}” isn't in your approved plan.";
            }
            if ($category === null) {
                $flags[] = "Couldn't tell which budget “{$name}” belongs to.";
            } else {
                $chosen = $selections[$category] ?? null;
                if ($chosen && (int) $chosen !== (int) $item->supplier_id) {
                    $flags[] = "“{$name}” isn't from your chosen supplier for {$category}.";
                }
                $requested[$category] = ($requested[$category] ?? 0) + $item->quantity * $item->estimated_unit_price;
            }
            if ($item->product && $item->quantity > $item->product->available_quantity) {
                $flags[] = "“{$name}”: the supplier only has {$item->product->available_quantity} {$item->unit} in stock.";
            }
        }

        $flags = [...$flags, ...$this->quantityFlags($request), ...$this->budgetFlags($budgets, $requested, $this->committedByCategory($project, $request->id))];
        $flags = array_values(array_unique($flags));

        return ['auto' => $flags === [] && $request->items->isNotEmpty(), 'flags' => $flags];
    }

    /**
     * What the project has already committed per plan category: items of approved or completed requests
     * whose supplier order is still alive. Requests still waiting for a decision don't count yet.
     *
     * @return array<string, int>
     */
    public function committedByCategory(Project $project, ?int $exceptRequestId = null): array
    {
        return $this->committedItems($project, $exceptRequestId)
            ->groupBy(fn (MaterialRequestItem $i) => $i->product ? (SupplierProduct::planCategoryFor($i->product->category) ?? '') : '')
            ->map(fn (Collection $items) => (int) $items->sum(fn (MaterialRequestItem $i) => $i->quantity * ($i->confirmed_unit_price ?? $i->estimated_unit_price)))
            ->all();
    }

    /** @return Collection<string, int> plan category => budget (₱), for the supplier-sourced categories */
    public function budgets(Project $project): Collection
    {
        return collect($project->approved_plan['budgetBreakdown'] ?? [])
            ->filter(fn ($line) => isset($line['category']) && array_key_exists($line['category'], SupplierProduct::PLAN_CATEGORIES))
            ->mapWithKeys(fn ($line) => [$line['category'] => (int) round((float) ($line['amount'] ?? 0))]);
    }

    /**
     * Each plan material may be ordered up to its planned quantity in total — this request plus what
     * earlier approved requests already took.
     *
     * @return array<int, string>
     */
    private function quantityFlags(MaterialRequest $request): array
    {
        $ordered = $this->committedItems($request->project, $request->id)
            ->groupBy(fn (MaterialRequestItem $i) => PlanMaterials::itemKey($i->supplier_product_id, $i->material_name))
            ->map(fn (Collection $items) => (int) $items->sum('quantity'));

        $flags = [];
        foreach ($request->items->groupBy(fn (MaterialRequestItem $i) => PlanMaterials::itemKey($i->supplier_product_id, $i->material_name)) as $key => $items) {
            $allowed = $items->first()->plan_quantity;
            if ($allowed === null) {
                continue; // already flagged as not in the plan
            }

            $total = (int) $items->sum('quantity') + (int) $ordered->get($key, 0);
            if ($total > $allowed) {
                $flags[] = "“{$items->first()->material_name}”: {$total} in total is more than the plan's {$allowed} {$items->first()->unit}.";
            }
        }

        return $flags;
    }

    /**
     * @param  Collection<string, int>  $budgets
     * @param  array<string, int>  $requested
     * @param  array<string, int>  $committed
     * @return array<int, string>
     */
    private function budgetFlags(Collection $budgets, array $requested, array $committed): array
    {
        $flags = [];
        foreach ($requested as $category => $amount) {
            if (! $budgets->has($category)) {
                $flags[] = "Your plan has no budget set for {$category}.";

                continue;
            }

            $over = ($committed[$category] ?? 0) + $amount - $budgets[$category];
            if ($over > 0) {
                $flags[] = "{$category} would be ₱".number_format($over).' over the plan budget of ₱'.number_format($budgets[$category]).'.';
            }
        }

        return $flags;
    }

    /** @return Collection<int, MaterialRequestItem> */
    private function committedItems(Project $project, ?int $exceptRequestId): Collection
    {
        return MaterialRequest::query()
            ->where('project_id', $project->id)
            ->when($exceptRequestId, fn ($q, $id) => $q->whereKeyNot($id))
            ->whereIn('status', [MaterialRequest::APPROVED, MaterialRequest::COMPLETED])
            ->with('items.product', 'items.order')
            ->get()
            ->flatMap(fn (MaterialRequest $r) => $r->items)
            ->filter(fn (MaterialRequestItem $i) => $i->supplier_order_id !== null && $i->order && ! $i->order->isDead())
            ->values();
    }
}
