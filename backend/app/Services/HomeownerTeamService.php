<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Arr;

/** Read-only project team snapshot. Membership comes from accepted pivots, never applications. */
class HomeownerTeamService
{
    public function __construct(private readonly WorkerService $workers, private readonly ContractorService $contractors) {}

    public function overview(User $owner, int $projectId): array
    {
        $project = $owner->projects()->whereIn('status', ['not_started', 'active', Project::PENDING_CONFIRMATION])
            ->with(['workers.workerProfile.skills', 'workers.ratingsReceived.rater', 'contractors.contractorProfile.skills', 'contractors.contractorRatingsReceived.rater'])
            ->findOrFail($projectId);
        $members = $project->workers->map(fn (User $worker) => Arr::only($this->workers->profile($worker, $owner), [
            'id', 'name', 'photoUrl', 'trade', 'skills', 'averageRating', 'ratingCount', 'minDailyWage',
        ]) + ['role' => 'worker', 'status' => 'Assigned'])->concat(
            $project->contractors->map(fn (User $contractor) => Arr::only($this->contractors->profile($contractor), [
                'id', 'name', 'photoUrl', 'specialization', 'companyName', 'skills', 'averageRating', 'ratingCount',
            ]) + ['role' => 'contractor', 'status' => 'Assigned'])
        )->values();
        $workerRequests = $project->workerRequests()->where('status', 'pending')->get(['worker_id', 'initiated_by']);
        $pendingContractors = $project->contractorRequests()->where('status', 'pending')->pluck('contractor_id');

        return [
            'projectId' => $project->id,
            'title' => $project->title,
            'status' => $project->status,
            'canInvite' => $project->status !== 'not_started',
            'approvedPlan' => $project->approved_plan,
            'team' => $members,
            'pendingWorkers' => $workerRequests->map(fn ($request) => ['workerId' => $request->worker_id, 'initiatedBy' => $request->initiated_by])->values(),
            'pendingContractorIds' => $pendingContractors->values(),
            'metrics' => [
                'total' => $members->count(),
                // This is project assignment, not a claim that someone has checked in today.
                'active' => $project->status === 'active' ? $members->count() : 0,
                'pending' => $workerRequests->count() + $pendingContractors->count(),
                // Approved plans contain skills and costs, but no staffing headcount target.
                'needed' => null,
            ],
        ];
    }
}
