<?php

namespace App\Services;

use App\Models\ContractorProfile;
use App\Models\ContractorRating;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ContractorService
{
    /**
     * @param  array{company_name: ?string, specialization: string, years_experience: int, bio: ?string, skills: array<int, string>}  $data
     */
    public function updateProfile(User $contractor, array $data): ContractorProfile
    {
        $profile = $contractor->contractorProfile()->updateOrCreate(
            ['user_id' => $contractor->id],
            [
                'company_name' => $data['company_name'] ?? null,
                'specialization' => $data['specialization'],
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
     * Rule-based match: approved contractors with a profile, scored by specialization
     * match, requested-skill overlap, average rating, and years of experience.
     *
     * @param  array<int, string>  $skills
     * @return Collection<int, array<string, mixed>>
     */
    public function search(?string $specialization, array $skills): Collection
    {
        $wanted = $specialization ? Str::lower(trim($specialization)) : null;
        $wantedSkills = collect($skills)->map(fn (string $s) => Str::lower(trim($s)))->filter()->values();

        return User::query()
            ->where('role', 'contractor')
            ->where('approval_status', 'approved')
            ->whereHas('contractorProfile')
            ->with(['contractorProfile.skills', 'contractorRatingsReceived'])
            ->get()
            ->map(function (User $contractor) use ($wanted, $wantedSkills) {
                $profile = $contractor->contractorProfile;
                $contractorSkills = $profile->skills->map(fn ($s) => Str::lower($s->skill));

                $specScore = 0;
                if ($wanted) {
                    $contractorSpec = Str::lower($profile->specialization);
                    if ($contractorSpec === $wanted) {
                        $specScore = 50;
                    } elseif (str_contains($contractorSpec, $wanted) || str_contains($wanted, $contractorSpec)) {
                        $specScore = 20;
                    }
                }

                $skillScore = 0;
                $matchedSkills = collect();
                if ($wantedSkills->isNotEmpty()) {
                    $matchedSkills = $wantedSkills->intersect($contractorSkills);
                    $skillScore = (int) round(($matchedSkills->count() / $wantedSkills->count()) * 40);
                }

                $ratingCount = $contractor->contractorRatingsReceived->count();
                $avgRating = $ratingCount ? round($contractor->contractorRatingsReceived->avg('score'), 1) : null;
                $ratingScore = $avgRating ? $avgRating * 2 : 0;

                $experienceScore = min($profile->years_experience, 10);

                return [
                    'id' => $contractor->id,
                    'name' => $contractor->name,
                    'email' => $contractor->email,
                    'companyName' => $profile->company_name,
                    'specialization' => $profile->specialization,
                    'yearsExperience' => $profile->years_experience,
                    'bio' => $profile->bio,
                    'skills' => $profile->skills->pluck('skill')->values(),
                    'averageRating' => $avgRating,
                    'ratingCount' => $ratingCount,
                    'matchedSkillCount' => $matchedSkills->count(),
                    'score' => $specScore + $skillScore + $ratingScore + $experienceScore,
                ];
            })
            ->sortByDesc('score')
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function profile(User $contractor): array
    {
        $contractor->loadMissing(['contractorProfile.skills', 'contractorRatingsReceived.rater']);
        $profile = $contractor->contractorProfile;
        $ratingCount = $contractor->contractorRatingsReceived->count();

        return [
            'id' => $contractor->id,
            'name' => $contractor->name,
            'companyName' => $profile?->company_name,
            'specialization' => $profile?->specialization,
            'yearsExperience' => $profile?->years_experience,
            'bio' => $profile?->bio,
            'skills' => $profile?->skills->pluck('skill')->values() ?? [],
            'averageRating' => $ratingCount ? round($contractor->contractorRatingsReceived->avg('score'), 1) : null,
            'ratingCount' => $ratingCount,
            'ratings' => $contractor->contractorRatingsReceived->sortByDesc('created_at')->values()->map(fn (ContractorRating $r) => [
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
    public function rate(User $contractor, User $rater, array $data): ContractorRating
    {
        if ($contractor->id === $rater->id) {
            throw ValidationException::withMessages(['score' => 'You cannot rate yourself.']);
        }

        if ($contractor->role !== 'contractor') {
            throw ValidationException::withMessages(['score' => 'Only contractors can be rated.']);
        }

        return ContractorRating::create([
            'contractor_id' => $contractor->id,
            'rater_id' => $rater->id,
            'score' => $data['score'],
            'comment' => $data['comment'] ?? null,
        ]);
    }
}
