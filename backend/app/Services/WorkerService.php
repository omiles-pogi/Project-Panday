<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkerProfile;
use App\Models\WorkerRating;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WorkerService
{
    /**
     * @param  array{trade: string, years_experience: int, bio: ?string, skills: array<int, string>}  $data
     */
    public function updateProfile(User $worker, array $data): WorkerProfile
    {
        $profile = $worker->workerProfile()->updateOrCreate(
            ['user_id' => $worker->id],
            [
                'trade' => $data['trade'],
                'years_experience' => $data['years_experience'],
                'bio' => $data['bio'] ?? null,
            ]
        );

        $skills = collect($data['skills'])
            ->map(fn (string $skill) => trim($skill))
            ->filter()
            ->unique(fn (string $skill) => Str::lower($skill))
            ->values();

        $profile->skills()->delete();
        $profile->skills()->createMany($skills->map(fn (string $skill) => ['skill' => $skill])->all());

        return $profile->load('skills');
    }

    /**
     * Rule-based match: approved workers with a profile, scored by trade match,
     * requested-skill overlap, average rating, and years of experience.
     *
     * @param  array<int, string>  $skills
     * @return Collection<int, array<string, mixed>>
     */
    public function search(?string $trade, array $skills): Collection
    {
        $wantedTrade = $trade ? Str::lower(trim($trade)) : null;
        $wantedSkills = collect($skills)->map(fn (string $s) => Str::lower(trim($s)))->filter()->values();

        return User::query()
            ->where('role', 'worker')
            ->where('approval_status', 'approved')
            ->whereHas('workerProfile')
            ->with(['workerProfile.skills', 'ratingsReceived'])
            ->get()
            ->map(function (User $worker) use ($wantedTrade, $wantedSkills) {
                $profile = $worker->workerProfile;
                $workerSkills = $profile->skills->map(fn ($s) => Str::lower($s->skill));

                $tradeScore = 0;
                if ($wantedTrade) {
                    $workerTrade = Str::lower($profile->trade);
                    if ($workerTrade === $wantedTrade) {
                        $tradeScore = 50;
                    } elseif (str_contains($workerTrade, $wantedTrade) || str_contains($wantedTrade, $workerTrade)) {
                        $tradeScore = 20;
                    }
                }

                $skillScore = 0;
                $matchedSkills = collect();
                if ($wantedSkills->isNotEmpty()) {
                    $matchedSkills = $wantedSkills->intersect($workerSkills);
                    $skillScore = (int) round(($matchedSkills->count() / $wantedSkills->count()) * 40);
                }

                $ratingCount = $worker->ratingsReceived->count();
                $avgRating = $ratingCount ? round($worker->ratingsReceived->avg('score'), 1) : null;
                $ratingScore = $avgRating ? $avgRating * 2 : 0;

                $experienceScore = min($profile->years_experience, 10);

                return [
                    'id' => $worker->id,
                    'name' => $worker->name,
                    'email' => $worker->email,
                    'trade' => $profile->trade,
                    'yearsExperience' => $profile->years_experience,
                    'bio' => $profile->bio,
                    'skills' => $profile->skills->pluck('skill')->values(),
                    'averageRating' => $avgRating,
                    'ratingCount' => $ratingCount,
                    'matchedSkillCount' => $matchedSkills->count(),
                    'score' => $tradeScore + $skillScore + $ratingScore + $experienceScore,
                ];
            })
            ->sortByDesc('score')
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function profile(User $worker): array
    {
        $worker->loadMissing(['workerProfile.skills', 'ratingsReceived.rater']);
        $profile = $worker->workerProfile;
        $ratingCount = $worker->ratingsReceived->count();

        return [
            'id' => $worker->id,
            'name' => $worker->name,
            'trade' => $profile?->trade,
            'yearsExperience' => $profile?->years_experience,
            'bio' => $profile?->bio,
            'skills' => $profile?->skills->pluck('skill')->values() ?? [],
            'averageRating' => $ratingCount ? round($worker->ratingsReceived->avg('score'), 1) : null,
            'ratingCount' => $ratingCount,
            'ratings' => $worker->ratingsReceived->sortByDesc('created_at')->values()->map(fn (WorkerRating $r) => [
                'score' => $r->score,
                'comment' => $r->comment,
                'raterName' => $r->rater->name,
                'createdAt' => $r->created_at->toDateString(),
            ]),
        ];
    }

    /**
     * @param  array{score: int, comment: ?string}  $data
     */
    public function rate(User $worker, User $rater, array $data): WorkerRating
    {
        if ($worker->id === $rater->id) {
            throw ValidationException::withMessages(['score' => 'You cannot rate yourself.']);
        }

        if ($worker->role !== 'worker') {
            throw ValidationException::withMessages(['score' => 'Only skilled workers can be rated.']);
        }

        return WorkerRating::create([
            'worker_id' => $worker->id,
            'rater_id' => $rater->id,
            'score' => $data['score'],
            'comment' => $data['comment'] ?? null,
        ]);
    }
}
