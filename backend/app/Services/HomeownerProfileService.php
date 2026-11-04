<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;

class HomeownerProfileService
{
    /**
     * @param  array{location?: ?string, contact_number?: ?string}  $data
     * @return array<string, mixed>
     */
    public function update(User $homeowner, array $data): array
    {
        $homeowner->homeownerProfile()->updateOrCreate(
            ['user_id' => $homeowner->id],
            [
                'location' => $data['location'] ?? null,
                'contact_number' => $data['contact_number'] ?? null,
            ]
        );

        return $this->show($homeowner->fresh());
    }

    /**
     * The homeowner's own view: their account, the details they edit, and a count of their projects.
     *
     * @return array<string, mixed>
     */
    public function show(User $homeowner): array
    {
        $profile = $homeowner->homeownerProfile;
        $byStatus = $homeowner->projects()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return [
            'id' => $homeowner->id,
            'name' => $homeowner->name,
            'email' => $homeowner->email,
            'memberSince' => $homeowner->created_at?->toDateString(),
            'location' => $profile?->location,
            'contactNumber' => $profile?->contact_number,
            'projects' => [
                'total' => (int) $byStatus->sum(),
                'notStarted' => (int) ($byStatus['not_started'] ?? 0),
                // Still ongoing while it waits for the homeowner's confirmation.
                'active' => (int) (($byStatus['active'] ?? 0) + ($byStatus[Project::PENDING_CONFIRMATION] ?? 0)),
                'completed' => (int) ($byStatus['completed'] ?? 0),
            ],
        ];
    }
}
