<?php

namespace App\Support;

use App\Models\User;

/** Portrait sharing follows the approved hiring directory, never general account visibility. */
class ProfilePhotoVisibility
{
    public static function directoryUrl(User $person): ?string
    {
        if ($person->approval_status !== 'approved') {
            return null;
        }
        $profile = match ($person->role) {
            'worker' => $person->workerProfile,
            'contractor' => $person->contractorProfile,
            default => null,
        };

        return $profile ? $person->profile_photo_url : null;
    }

    public static function canView(User $viewer, User $person): bool
    {
        return $viewer->id === $person->id
            || ($viewer->role === 'homeowner' && self::directoryUrl($person) !== null);
    }
}
