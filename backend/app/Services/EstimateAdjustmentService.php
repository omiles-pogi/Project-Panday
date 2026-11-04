<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\Project;
use App\Support\PlanMaterials;
use App\Support\Wage;
use Illuminate\Support\Collection;

/**
 * Keeps the project's estimate honest when the work outgrows the plan. The AI's estimate covers the
 * materials and labor the plan describes; a sudden request — materials the plan never listed, more of a
 * material than it allowed, or hiring that takes team wages past the plan's own labor and contractor
 * lines — is extra cost on top of it. That extra is added to the estimate, so what's left of the
 * homeowner's budget goes down by the same amount.
 *
 * Only what is actually committed counts: approved (or completed) requests with a live supplier order,
 * and the wages of people on the team. A request still waiting for approval is reported separately, as a
 * heads-up, and moves into the estimate the moment it is approved. Where the plan has nothing to compare
 * against (no material list, no labor line), that part is left out rather than guessed.
 */
class EstimateAdjustmentService
{
    private const LABOR_LINE = 'Labor Costs';

    private const CONTRACTOR_LINE = 'Contractor and Project Management Fee';

    /**
     * @return array{planEstimate: int, adjustedEstimate: int, additionsTotal: int, additions: array<int, array<string, mixed>>, pendingMaterialsTotal: int}
     */
    public function forProject(Project $project): array
    {
        $project->loadMissing('workers', 'contractors');

        $approved = $this->liveItems($project, [MaterialRequest::APPROVED, MaterialRequest::COMPLETED]);
        $pending = $this->liveItems($project, [MaterialRequest::PENDING], requireOrder: false);
        $results = $this->outsidePlan($project, $approved->concat($pending));
        $approvedCount = $approved->count();

        $materialLines = $results->take($approvedCount)->filter(fn (array $r) => $r['amount'] > 0)->values();
        $pendingTotal = (int) $results->slice($approvedCount)->sum('amount');

        $additions = array_values(array_filter([
            $materialLines->isNotEmpty() ? [
                'kind' => 'materials',
                'label' => 'Materials outside the plan',
                'amount' => (int) $materialLines->sum('amount'),
                'lines' => $materialLines->map(fn (array $r) => [
                    'requestId' => $r['requestId'],
                    'material' => $r['material'],
                    'quantity' => $r['extraQuantity'],
                    'unit' => $r['unit'],
                    'amount' => $r['amount'],
                    'reason' => $r['reason'],
                ])->all(),
            ] : null,
            ...$this->teamAdditions($project),
        ]));

        $additionsTotal = (int) collect($additions)->sum('amount');

        return [
            'planEstimate' => (int) $project->total_estimate,
            'adjustedEstimate' => (int) $project->total_estimate + $additionsTotal,
            'additionsTotal' => $additionsTotal,
            'additions' => $additions,
            'pendingMaterialsTotal' => $pendingTotal,
        ];
    }

    /**
     * What approving this request would add to the estimate: its materials that fall outside the plan,
     * after what earlier approved requests already used up.
     */
    public function impactOfRequest(MaterialRequest $request): int
    {
        $project = $request->project;
        $earlier = $this->liveItems($project, [MaterialRequest::APPROVED, MaterialRequest::COMPLETED])
            ->reject(fn (MaterialRequestItem $i) => $i->material_request_id === $request->id);
        $own = $request->items->values();

        return (int) $this->outsidePlan($project, $earlier->concat($own))->slice($earlier->count())->sum('amount');
    }

    /**
     * Walks items in the order they were requested, giving each plan material its allowance once: an
     * item inside what's left of its plan quantity costs nothing extra, the rest — or an item the plan
     * never had — is extra cost.
     *
     * @param  Collection<int, MaterialRequestItem>  $items
     * @return Collection<int, array{requestId: int, material: string, unit: string, extraQuantity: int, amount: int, reason: string}>
     */
    private function outsidePlan(Project $project, Collection $items): Collection
    {
        // No material list to measure against: say nothing rather than call every order "unplanned".
        if (PlanMaterials::lines($project)->isEmpty()) {
            return $items->map(fn (MaterialRequestItem $i) => $this->line($i, 0, 'not in plan'));
        }

        $ordered = [];

        return $items->map(function (MaterialRequestItem $item) use ($project, &$ordered) {
            $key = PlanMaterials::itemKey($item->supplier_product_id, $item->material_name);
            $allowed = $item->plan_quantity
                ?? PlanMaterials::match($project, $item->supplier_product_id, $item->material_name)['plannedQuantity']
                ?? null;

            $remaining = max(0, ($allowed ?? 0) - ($ordered[$key] ?? 0));
            $extra = max(0, $item->quantity - $remaining);
            $ordered[$key] = ($ordered[$key] ?? 0) + $item->quantity;

            return $this->line($item, $extra, $allowed === null ? 'not in plan' : 'above plan');
        })->values();
    }

    /** @return array{requestId: int, material: string, unit: string, extraQuantity: int, amount: int, reason: string} */
    private function line(MaterialRequestItem $item, int $extraQuantity, string $reason): array
    {
        return [
            'requestId' => $item->material_request_id,
            'material' => $item->material_name,
            'unit' => $item->unit,
            'extraQuantity' => $extraQuantity,
            'amount' => $extraQuantity * ($item->confirmed_unit_price ?? $item->estimated_unit_price),
            'reason' => $reason,
        ];
    }

    /**
     * Hiring beyond what the plan set aside: the team's wages against the plan's labor line (workers) and
     * its contractor fee line (contractors). A line the plan doesn't have is left out.
     *
     * @return array<int, array<string, mixed>>
     */
    private function teamAdditions(Project $project): array
    {
        $budgets = collect($project->approved_plan['budgetBreakdown'] ?? [])->mapWithKeys(fn ($l) => [$l['category'] => (int) round((float) $l['amount'])]);
        $total = fn (Collection $members) => (int) $members->sum(fn ($m) => Wage::fromPivot($m->pivot)['total'] ?? 0);

        $additions = [];
        foreach ([
            ['workers', 'Workers hired beyond the labor budget', self::LABOR_LINE, $total($project->workers)],
            ['contractors', 'Contractor fees beyond the plan', self::CONTRACTOR_LINE, $total($project->contractors)],
        ] as [$kind, $label, $line, $wages]) {
            if (! $budgets->has($line)) {
                continue;
            }

            $extra = $wages - $budgets[$line];
            if ($extra > 0) {
                $additions[] = ['kind' => $kind, 'label' => $label, 'amount' => $extra, 'budget' => $budgets[$line], 'wages' => $wages];
            }
        }

        return $additions;
    }

    /**
     * Items of requests in these statuses, oldest first. Committed ones need a supplier order that is
     * still alive; a pending request has no order yet, so its items are taken as they stand.
     *
     * @param  array<int, string>  $statuses
     * @return Collection<int, MaterialRequestItem>
     */
    private function liveItems(Project $project, array $statuses, bool $requireOrder = true): Collection
    {
        return MaterialRequest::query()
            ->where('project_id', $project->id)
            ->whereIn('status', $statuses)
            ->orderBy('id')
            ->with('items.order')
            ->get()
            ->flatMap(fn (MaterialRequest $r) => $r->items)
            ->filter(fn (MaterialRequestItem $i) => ! $requireOrder || ($i->supplier_order_id !== null && $i->order && ! $i->order->isDead()))
            ->values();
    }
}
