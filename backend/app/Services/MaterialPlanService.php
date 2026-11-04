<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Support\PlanMaterials;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Plans a project's materials phase by phase. The AI plan says which phase needs each material; the
 * calendar says when that phase starts, so each phase's materials have a "needed by" date. The
 * contractor reviews the AI's quantities once (adding waste where it belongs), then raises one request
 * per phase from the reviewed plan. The homeowner sees how the reviewed quantities compare with the AI's.
 */
class MaterialPlanService
{
    public function __construct(
        private readonly MaterialRequestService $requests,
        private readonly MaterialApprovalPolicy $policy,
        private readonly TimelineService $timeline,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function planFor(Project $project, User $viewer): array
    {
        // Also checks the viewer is the owner or an assigned contractor.
        $suggestions = $this->requests->aiSuggestions($project, $viewer);

        $this->timeline->ensureSchedule($project);
        $project->load('phases', 'materialsReviewer:id,name');
        $leadDays = (int) config('materials.lead_days');
        $today = Carbon::today();

        $requestsByPhase = $this->visibleRequests($project, $viewer)->groupBy('phase_id');
        $phaseByName = $project->phases->mapWithKeys(fn (ProjectPhase $p) => [PlanMaterials::normalize($p->name) => $p]);

        $lines = $suggestions->map(fn (array $s) => $s + [
            'unitPrice' => $s['match']['price'] ?? $s['estimatedUnitPrice'],
            'lineTotal' => $s['quantity'] * ($s['match']['price'] ?? $s['estimatedUnitPrice']),
            'aiLineTotal' => $s['aiQuantity'] * ($s['match']['price'] ?? $s['estimatedUnitPrice']),
        ]);

        $grouped = $lines->groupBy(fn (array $l) => ($phaseByName->get(PlanMaterials::normalize($l['phase']))?->id) ?? 0);

        $phases = $project->phases
            ->filter(fn (ProjectPhase $p) => $grouped->has($p->id))
            ->map(function (ProjectPhase $phase) use ($grouped, $requestsByPhase, $leadDays, $today) {
                $neededBy = $phase->planned_start->copy()->subDays($leadDays);

                return [
                    'phaseId' => $phase->id,
                    'name' => $phase->name,
                    'startDate' => $phase->planned_start->toDateString(),
                    'neededBy' => $neededBy->toDateString(),
                    // Negative once the order date has passed.
                    'daysUntilNeeded' => (int) $today->diffInDays($neededBy),
                    'progressPct' => $phase->progress_pct,
                    'lineCount' => $grouped[$phase->id]->count(),
                    'estimatedTotal' => (int) $grouped[$phase->id]->sum('lineTotal'),
                    'lines' => $grouped[$phase->id]->values()->all(),
                    'requests' => ($requestsByPhase->get($phase->id) ?? collect())->map(fn (MaterialRequest $r) => [
                        'id' => $r->id,
                        'status' => $r->status,
                        'autoApproved' => $r->auto_approved,
                        'estimatedTotal' => $r->estimated_total,
                    ])->values()->all(),
                ];
            })->values();

        $unscheduled = $grouped->get(0);
        $aiTotal = (int) $lines->sum('aiLineTotal');
        $plannedTotal = (int) $lines->sum('lineTotal');

        return [
            'projectId' => $project->id,
            'title' => $project->title,
            'hasPlan' => $lines->isNotEmpty(),
            'reviewed' => $project->materials_reviewed_at !== null,
            'reviewedAt' => $project->materials_reviewed_at?->toIso8601String(),
            'reviewedBy' => $project->materialsReviewer?->name,
            'autoApprove' => (bool) $project->auto_approve_materials,
            // What the review changed: the AI's total vs the reviewed plan's, at current prices.
            'aiTotal' => $aiTotal,
            'plannedTotal' => $plannedTotal,
            'variancePct' => $aiTotal > 0 ? (int) round(($plannedTotal - $aiTotal) / $aiTotal * 100) : 0,
            'phases' => $phases->all(),
            'unscheduled' => $unscheduled === null ? null : [
                'lineCount' => $unscheduled->count(),
                'estimatedTotal' => (int) $unscheduled->sum('lineTotal'),
                'lines' => $unscheduled->values()->all(),
            ],
            'categoryBudgets' => $this->categoryBudgets($project),
        ];
    }

    /**
     * The contractor's one-time check of the AI's quantities: what they really need, plus a waste
     * allowance. Lines they don't mention are accepted as the AI wrote them. Re-reviewing later is
     * allowed — it changes what future phase requests are built from, never a request already made.
     *
     * @param  array<int, array{index: int, quantity: int, waste_pct?: int}>  $changes
     * @return array<string, mixed>
     */
    public function review(Project $project, User $contractor, array $changes): array
    {
        $this->assertContractor($project, $contractor);

        $raw = $project->ai_materials ?? [];
        if ($raw === []) {
            throw ValidationException::withMessages(['lines' => 'This project has no AI material plan to review.']);
        }

        $byIndex = collect($changes)->keyBy('index');
        foreach ($byIndex->keys() as $index) {
            if (! array_key_exists($index, $raw)) {
                throw ValidationException::withMessages(['lines' => 'One of the lines is no longer in the plan.']);
            }
        }

        $adjusted = 0;
        foreach ($raw as $index => $line) {
            $aiQty = max(1, (int) ceil((float) ($line['qty'] ?? 1)));
            $change = $byIndex->get($index);
            $quantity = (int) ($change['quantity'] ?? $line['contractorQty'] ?? $aiQty);
            $waste = (int) ($change['waste_pct'] ?? $line['wastePct'] ?? 0);

            $raw[$index]['contractorQty'] = $quantity;
            $raw[$index]['wastePct'] = $waste;
            $raw[$index]['reviewedQty'] = (int) ceil($quantity * (1 + $waste / 100));

            if ($raw[$index]['reviewedQty'] !== $aiQty) {
                $adjusted++;
            }
        }

        $project->update([
            'ai_materials' => $raw,
            'materials_reviewed_at' => now(),
            'materials_reviewed_by' => $contractor->id,
        ]);

        $plan = $this->planFor($project->refresh(), $contractor);
        $change = $plan['variancePct'] === 0 ? 'no change in cost' : ($plan['variancePct'] > 0 ? "+{$plan['variancePct']}%" : "{$plan['variancePct']}%").' vs the AI estimate';
        $this->notifications->send(
            $project->user,
            'materials_reviewed',
            'Material quantities reviewed',
            "{$contractor->name} reviewed the material quantities for \"{$project->title}\": {$adjusted} of ".count($raw)." lines changed ({$change}).",
            ['projectId' => $project->id, 'projectTitle' => $project->title]
        );

        return $plan;
    }

    /**
     * Drafts the material request for one phase from the reviewed plan, so the contractor opens it, checks
     * it and submits instead of building it line by line. Asking again returns the draft already started.
     *
     * @return array<string, mixed> the presented request
     *
     * @throws ValidationException
     */
    public function requestForPhase(Project $project, User $contractor, ProjectPhase $phase): array
    {
        $this->assertContractor($project, $contractor);

        if (PlanMaterials::lines($project)->isNotEmpty() && ! $project->materials_reviewed_at) {
            throw ValidationException::withMessages(['review' => 'Review the AI material quantities first — it only takes one pass, and every phase request is built from it.']);
        }

        $planned = PlanMaterials::lines($project)
            ->filter(fn (array $l) => PlanMaterials::normalize($l['phase']) === PlanMaterials::normalize($phase->name))
            ->values();
        if ($planned->isEmpty()) {
            throw ValidationException::withMessages(['phase_id' => 'The plan has no materials for this phase.']);
        }

        $existing = MaterialRequest::query()
            ->where('project_id', $project->id)->where('phase_id', $phase->id)
            ->whereNotIn('status', [MaterialRequest::REJECTED, MaterialRequest::CANCELLED])
            ->latest('id')->first();
        if ($existing) {
            if ($existing->contractor_id === $contractor->id && $existing->isEditable()) {
                return $this->requests->show($existing, $contractor);
            }
            throw ValidationException::withMessages(['phase_id' => "Materials for this phase were already requested (request #{$existing->id})."]);
        }

        $this->timeline->ensureSchedule($project);
        $phase->refresh();
        $suggestions = $this->requests->aiSuggestions($project, $contractor)->keyBy('index');

        $request = DB::transaction(function () use ($project, $contractor, $phase, $planned, $suggestions) {
            $created = MaterialRequest::findOrFail($this->requests->create($contractor, $project, "Materials for {$phase->name}")['id']);
            $created->update([
                'phase_id' => $phase->id,
                'needed_by' => $phase->planned_start?->copy()->subDays((int) config('materials.lead_days')),
            ]);

            foreach ($planned as $line) {
                $created->items()->create($this->itemFor($line, $suggestions->get($line['index'])['match'] ?? null));
            }

            $created->update(['estimated_total' => (int) $created->items()->sum(DB::raw('quantity * estimated_unit_price'))]);

            return $created;
        });

        return $this->requests->show($request, $contractor);
    }

    /**
     * Lets the homeowner switch automatic approval of plan-covered requests on or off for this project.
     *
     * @return array{autoApprove: bool}
     */
    public function setAutoApprove(Project $project, User $homeowner, bool $enabled): array
    {
        if (! $project->isOwnedBy($homeowner)) {
            throw ValidationException::withMessages(['project_id' => 'This is not your project.']);
        }

        $project->update(['auto_approve_materials' => $enabled]);

        return ['autoApprove' => $enabled];
    }

    /**
     * @param  array<string, mixed>  $line
     * @param  array<string, mixed>|null  $match  the supplier listing the AI suggestion matched, if any
     * @return array<string, mixed>
     */
    private function itemFor(array $line, ?array $match): array
    {
        $listing = $match ? SupplierProduct::query()->listed()->find($match['supplierProductId']) : null;

        return [
            'supplier_product_id' => $listing?->id,
            'supplier_id' => $listing?->supplier_id,
            // A matched line takes its name, unit and price from the live listing; an unmatched one keeps the
            // plan's own as a placeholder until the contractor picks a listing.
            'material_name' => $listing?->name ?? $line['material'],
            'unit' => $listing?->unit ?? $line['unit'],
            'estimated_unit_price' => $listing?->price ?? $line['estimatedUnitPrice'],
            'quantity' => $line['plannedQuantity'],
            'source' => 'ai',
            'ai_quantity' => $line['aiQuantity'],
            'plan_quantity' => $line['plannedQuantity'],
            'waste_pct' => $line['wastePct'],
        ];
    }

    /**
     * Budget vs what's already committed, for the supplier-sourced categories — so everyone can see how
     * much room the plan leaves.
     *
     * @return array<int, array{category: string, budget: int, committed: int, remaining: int}>
     */
    private function categoryBudgets(Project $project): array
    {
        $committed = $this->policy->committedByCategory($project);

        return $this->policy->budgets($project)->map(fn (int $budget, string $category) => [
            'category' => $category,
            'budget' => $budget,
            'committed' => (int) ($committed[$category] ?? 0),
            'remaining' => $budget - (int) ($committed[$category] ?? 0),
        ])->values()->all();
    }

    /** @return Collection<int, MaterialRequest> the requests this viewer may see, not counting rejected or cancelled ones */
    private function visibleRequests(Project $project, User $viewer): Collection
    {
        return MaterialRequest::query()
            ->where('project_id', $project->id)
            ->whereNotNull('phase_id')
            ->whereNotIn('status', [MaterialRequest::REJECTED, MaterialRequest::CANCELLED])
            ->when(
                $viewer->role === 'contractor',
                fn ($q) => $q->where('contractor_id', $viewer->id),
                // A contractor's draft is their own work in progress, not the homeowner's to see.
                fn ($q) => $q->where('status', '!=', MaterialRequest::DRAFT)
            )
            ->get();
    }

    private function assertContractor(Project $project, User $contractor): void
    {
        $project->loadMissing('contractors:id');
        if (! $project->hasAssignedContractor($contractor)) {
            throw ValidationException::withMessages(['project_id' => 'You are not assigned to this project.']);
        }
    }
}
