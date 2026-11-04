<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Support\Wage;

/**
 * Works out team wages so nobody has to type them in. A worker's wage is their own minimum daily wage
 * (or a configured default) × the project's working days; a contractor's is the plan's "Contractor and
 * Project Management Fee" line split between the project's contractors. A contractor who applied with a
 * quote keeps that quote instead. Everything filled in here is flagged `wage_auto` and kept current;
 * a wage someone sets by hand is never touched.
 */
class WageService
{
    private const FEE_CATEGORY = 'Contractor and Project Management Fee';

    /**
     * Fills in every team member's missing wage and refreshes the automatic ones. Idempotent.
     *
     * @param  bool|array<int, int>  $fillMissing  true fills everyone with no wage (the backfill); false
     *                                             fills nobody — used when only an input changed (a worker's rate), so a wage
     *                                             someone cleared on purpose stays cleared; a list of user ids fills just those
     *                                             people (a new joiner), leaving everyone else as they are.
     * @return int how many wages were written
     */
    public function syncAutoWages(Project $project, bool|array $fillMissing = true): int
    {
        $project->unsetRelation('workers')->unsetRelation('contractors');
        $project->load(['workers.workerProfile', 'contractors']);

        $changed = 0;
        $contractorCount = $project->contractors->count();

        foreach ($project->workers as $worker) {
            if ($this->shouldWrite($worker, $fillMissing)) {
                $changed += $this->write($project->workers(), $worker, $this->workerWage($project, $worker));
            }
        }

        foreach ($project->contractors as $contractor) {
            if ($this->shouldWrite($contractor, $fillMissing)) {
                $changed += $this->write($project->contractors(), $contractor, $this->contractorFee($project, $contractorCount));
            }
        }

        return $changed;
    }

    /** Re-works a worker's automatic wages after they change their minimum daily wage. */
    public function syncForWorker(User $worker): void
    {
        $worker->workerAssignments()->get()->each(fn (Project $project) => $this->syncAutoWages($project, fillMissing: false));
    }

    /** @return array{wage_amount: int, wage_unit: string, wage_days: int, wage_auto: bool} */
    public function workerWage(Project $project, User $worker): array
    {
        return [
            'wage_amount' => (int) ($worker->workerProfile?->min_daily_wage ?: config('wages.default_daily_rate')),
            'wage_unit' => Wage::PER_DAY,
            'wage_days' => $this->workingDays($project),
            'wage_auto' => true,
        ];
    }

    /** @return array{wage_amount: int, wage_unit: string, wage_days: null, wage_auto: bool}|null null when there's nothing to base a fee on */
    public function contractorFee(Project $project, int $contractorCount): ?array
    {
        $fee = (int) round($this->contractorFeePool($project) / max(1, $contractorCount));

        return $fee > 0
            ? ['wage_amount' => $fee, 'wage_unit' => Wage::FIXED, 'wage_days' => null, 'wage_auto' => true]
            : null;
    }

    /** Days of work in the project's timeline. */
    public function workingDays(Project $project): int
    {
        return max(1, (int) round(max(1, (int) $project->timeline_months) * (int) config('wages.working_days_per_month')));
    }

    /** What all contractors share: the approved plan's fee line, else a percentage of the estimate. */
    private function contractorFeePool(Project $project): int
    {
        $line = collect($project->approved_plan['budgetBreakdown'] ?? [])->firstWhere('category', self::FEE_CATEGORY);
        $fromPlan = (int) round((float) ($line['amount'] ?? 0));

        return $fromPlan > 0
            ? $fromPlan
            : (int) round($project->total_estimate * (float) config('wages.contractor_fee_pct') / 100);
    }

    /** @param  bool|array<int, int>  $fillMissing */
    private function shouldWrite(User $member, bool|array $fillMissing): bool
    {
        $pivot = $member->pivot;
        $mayFill = is_array($fillMissing) ? in_array($member->id, $fillMissing, true) : $fillMissing;

        return (bool) $pivot->wage_auto || ($mayFill && $pivot->wage_amount === null);
    }

    /**
     * @param  array<string, mixed>|null  $attributes
     */
    private function write($relation, User $member, ?array $attributes): int
    {
        if ($attributes === null) {
            return 0;
        }

        $pivot = $member->pivot;
        $same = (int) $pivot->wage_amount === $attributes['wage_amount']
            && $pivot->wage_unit === $attributes['wage_unit']
            && ($pivot->wage_days === null ? null : (int) $pivot->wage_days) === $attributes['wage_days']
            && (bool) $pivot->wage_auto === $attributes['wage_auto'];

        if ($same) {
            return 0;
        }

        $relation->updateExistingPivot($member->id, $attributes);

        return 1;
    }
}
