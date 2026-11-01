<?php

namespace App\Services;

use App\Models\ContractorRating;
use App\Models\Project;
use App\Models\User;
use App\Models\WorkerRating;
use Illuminate\Validation\ValidationException;

/**
 * End-of-project reviews: once a project reaches 100%, its homeowner rates each contractor and
 * worker on the team — once per person per project. Separate from the free-standing ratings on
 * the Find Team screen (WorkerService::rate / ContractorService::rate), which aren't tied to a
 * project and so can't be trusted to mean "this person worked on my project".
 */
class ProjectRatingService
{
    public function __construct(private readonly NotificationService $notifications) {}

    /**
     * The team with each member's rating state, and whether rating is open yet.
     *
     * @return array<string, mixed>
     */
    public function statusFor(Project $project, User $actingUser): array
    {
        $this->authorizeOwner($project, $actingUser);
        $project->load(['phases', 'workers.workerProfile', 'contractors.contractorProfile']);

        $workerRatings = WorkerRating::query()
            ->where('project_id', $project->id)->where('rater_id', $actingUser->id)
            ->get()->keyBy('worker_id');
        $contractorRatings = ContractorRating::query()
            ->where('project_id', $project->id)->where('rater_id', $actingUser->id)
            ->get()->keyBy('contractor_id');

        $team = collect();
        foreach ($project->contractors as $contractor) {
            $rating = $contractorRatings->get($contractor->id);
            $team->push([
                'userId' => $contractor->id,
                'role' => 'contractor',
                'name' => $contractor->contractorProfile?->company_name ?: $contractor->name,
                'subtitle' => $contractor->contractorProfile?->specialization ?: 'Contractor',
                'rated' => $rating !== null,
                'score' => $rating?->score,
                'comment' => $rating?->comment,
            ]);
        }
        foreach ($project->workers as $worker) {
            $rating = $workerRatings->get($worker->id);
            $team->push([
                'userId' => $worker->id,
                'role' => 'worker',
                'name' => $worker->name,
                'subtitle' => $worker->workerProfile?->trade ?: 'Worker',
                'rated' => $rating !== null,
                'score' => $rating?->score,
                'comment' => $rating?->comment,
            ]);
        }

        return [
            'projectId' => $project->id,
            'overallProgressPct' => $project->overallProgressPct(),
            'canRate' => $this->isComplete($project),
            'pendingCount' => $team->where('rated', false)->count(),
            'team' => $team->values(),
        ];
    }

    /**
     * @param  array{user_id: int, score: int, comment?: ?string}  $data
     * @return array<string, mixed> The refreshed status, so the client doesn't need a second request.
     */
    public function rate(Project $project, User $homeowner, array $data): array
    {
        $this->authorizeOwner($project, $homeowner);
        $project->load('phases');

        if (! $this->isComplete($project)) {
            throw ValidationException::withMessages(['project_id' => 'You can rate your team once the project is 100% complete.']);
        }

        $ratee = User::query()->find($data['user_id']);
        $isWorker = $ratee && $project->workers()->whereKey($ratee->id)->exists();
        $isContractor = $ratee && $project->contractors()->whereKey($ratee->id)->exists();
        if (! $isWorker && ! $isContractor) {
            throw ValidationException::withMessages(['user_id' => 'That person is not on this project\'s team.']);
        }

        $attributes = [
            'rater_id' => $homeowner->id,
            'project_id' => $project->id,
            'score' => $data['score'],
            'comment' => $data['comment'] ?? null,
        ];

        if ($isContractor) {
            if (ContractorRating::query()->where(['project_id' => $project->id, 'rater_id' => $homeowner->id, 'contractor_id' => $ratee->id])->exists()) {
                throw ValidationException::withMessages(['user_id' => 'You already rated this contractor for this project.']);
            }
            ContractorRating::create($attributes + ['contractor_id' => $ratee->id]);
        } else {
            if (WorkerRating::query()->where(['project_id' => $project->id, 'rater_id' => $homeowner->id, 'worker_id' => $ratee->id])->exists()) {
                throw ValidationException::withMessages(['user_id' => 'You already rated this worker for this project.']);
            }
            WorkerRating::create($attributes + ['worker_id' => $ratee->id]);
        }

        $this->notifications->send(
            $ratee,
            'rating_received',
            'You received a rating',
            "{$homeowner->name} rated your work on \"{$project->title}\": {$data['score']}/5.",
            ['projectId' => $project->id, 'projectTitle' => $project->title],
        );

        return $this->statusFor($project, $homeowner);
    }

    private function isComplete(Project $project): bool
    {
        return $project->phases->isNotEmpty() && $project->overallProgressPct() >= 100;
    }

    private function authorizeOwner(Project $project, User $actingUser): void
    {
        if ($project->user_id !== $actingUser->id) {
            throw ValidationException::withMessages(['project_id' => 'This is not your project.']);
        }
    }
}
