<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Support\Wage;
use Illuminate\Validation\ValidationException;

class HiringWageService
{
    public function __construct(private readonly WageService $wages) {}

    /** Preview the selected project's hiring costs without assigning people or setting wages. */
    public function forProject(Project $project, User $viewer): array
    {
        abort_unless($project->isOwnedBy($viewer), 403);
        if ($project->status === 'not_started') {
            throw ValidationException::withMessages(['project_id' => 'Approve the project plan before previewing team wages.']);
        }

        $project->load(['workers', 'contractors']);
        $assignedWorkers = $project->workers->keyBy('id');
        $assignedContractors = $project->contractors->keyBy('id');
        $quotes = $project->contractorRequests()->where('status', 'pending')
            ->where('initiated_by', 'contractor')->whereNotNull('quote_amount')
            ->latest('id')->get()->unique('contractor_id')->keyBy('contractor_id');

        $workers = User::query()->where('role', 'worker')->where('approval_status', 'approved')
            ->whereHas('workerProfile')->with('workerProfile')->get()
            ->map(function (User $worker) use ($project, $assignedWorkers) {
                if ($assignedWorkers->has($worker->id)) {
                    return ['userId' => $worker->id, 'wage' => Wage::fromPivot($assignedWorkers[$worker->id]->pivot), 'source' => 'project'];
                }

                return [
                    'userId' => $worker->id,
                    'wage' => $this->previewWage($this->wages->workerWage($project, $worker)),
                    'source' => $worker->workerProfile->min_daily_wage > 0 ? 'worker_minimum' : 'app_default',
                ];
            })->values()->all();

        // Preview the fee this candidate would receive after joining, including the new member
        // in the split. Other candidates in the search are alternatives, not additional hires.
        $prospectiveFee = $this->wages->contractorFee($project, $assignedContractors->count() + 1);
        $contractors = User::query()->where('role', 'contractor')->where('approval_status', 'approved')
            ->whereHas('contractorProfile')->get()->map(function (User $contractor) use ($assignedContractors, $quotes, $prospectiveFee) {
                if ($assignedContractors->has($contractor->id)) {
                    return ['userId' => $contractor->id, 'wage' => Wage::fromPivot($assignedContractors[$contractor->id]->pivot), 'source' => 'project'];
                }
                if ($quotes->has($contractor->id)) {
                    $amount = (int) $quotes[$contractor->id]->quote_amount;

                    return ['userId' => $contractor->id, 'wage' => ['amount' => $amount, 'unit' => Wage::FIXED, 'days' => null, 'total' => $amount, 'auto' => false], 'source' => 'application_quote'];
                }

                return ['userId' => $contractor->id, 'wage' => $this->previewWage($prospectiveFee), 'source' => 'project_estimate'];
            })->values()->all();

        return ['projectId' => $project->id, 'workers' => $workers, 'contractors' => $contractors];
    }

    private function previewWage(?array $attributes): ?array
    {
        if ($attributes === null) {
            return null;
        }

        return [
            'amount' => $attributes['wage_amount'],
            'unit' => $attributes['wage_unit'],
            'days' => $attributes['wage_days'],
            'total' => Wage::total($attributes['wage_amount'], $attributes['wage_unit'], $attributes['wage_days']),
            'auto' => true,
        ];
    }
}
