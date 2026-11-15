<?php

namespace App\Services;

use App\Models\User;
use App\Support\AccountPasswordRules;
use App\Support\ProfilePhotoVisibility;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use Throwable;

class AccountService
{
    public const DEFAULT_PREFERENCES = ['push_enabled' => true, 'project_updates' => true, 'messages' => true];

    public static function preferences(User $user): array
    {
        $saved = array_key_exists('notification_preferences', $user->getAttributes()) ? ($user->notification_preferences ?? []) : [];

        return array_map(fn ($value) => (bool) $value, array_replace(self::DEFAULT_PREFERENCES, array_intersect_key($saved, self::DEFAULT_PREFERENCES)));
    }

    public function present(User $user): array
    {
        $this->requireSchema();

        return ['userId' => $user->id, 'photoUrl' => $user->profile_photo_url, 'preferences' => self::preferences($user)];
    }

    public function updatePreferences(User $user, array $changes): array
    {
        $this->requireSchema();
        if ($changes === []) {
            throw ValidationException::withMessages(['preferences' => 'Choose at least one preference to update.']);
        }

        return DB::transaction(function () use ($user, $changes) {
            $locked = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $locked->notification_preferences = array_replace(self::preferences($locked), array_map(fn ($value) => (bool) $value, array_intersect_key($changes, self::DEFAULT_PREFERENCES)));
            $locked->save();

            return $this->present($locked);
        });
    }

    public function photo(User $user, ?UploadedFile $photo): array
    {
        $this->requireSchema();
        $newPath = $photo?->store('profile-photos', 'local');
        abort_if($photo && ! $newPath, 500, 'Could not save your photo. Please try again.');
        try {
            $oldPath = DB::transaction(function () use ($user, $newPath) {
                $locked = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                $old = $locked->profile_photo_path;
                $locked->profile_photo_path = $newPath;
                $locked->save();

                return $old;
            });
        } catch (Throwable $error) {
            if ($newPath) {
                Storage::disk('local')->delete($newPath);
            }
            throw $error;
        }
        // Delete only this account's replaced upload, after the new database value committed.
        if ($oldPath && str_starts_with($oldPath, 'profile-photos/')) {
            Storage::disk('local')->delete($oldPath);
        }

        return $this->present($user->refresh());
    }

    public function changePassword(User $user, string $current, string $password): void
    {
        $token = $user->currentAccessToken();
        $currentTokenId = $token instanceof PersonalAccessToken ? $token->getKey() : null;
        $restricted = AccountPasswordRules::requiresUpdate($user);
        DB::transaction(function () use ($user, $current, $password, $currentTokenId, $restricted) {
            $locked = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if (! Hash::check($current, $locked->password)) {
                throw ValidationException::withMessages(['current_password' => 'Current password is incorrect.']);
            }
            if (Hash::check($password, $locked->password)) {
                throw ValidationException::withMessages(['password' => 'Choose a different password from your current password.']);
            }
            $locked->password = Hash::make($password);
            $locked->save();
            // End a limited session on success; normal access requires a fresh sign-in.
            $locked->tokens()->when($currentTokenId && ! $restricted, fn ($query) => $query->whereKeyNot($currentTokenId))->delete();
            DB::table('password_reset_tokens')->where('email', $locked->email)->delete();
        });
    }

    public function image(User $viewer, int $userId, string $version)
    {
        $user = $viewer->id === $userId ? $viewer->fresh() : User::find($userId);
        // Keep private local storage and authentication. Only portraits from the approved
        // worker/contractor directory may additionally be viewed by a homeowner.
        abort_unless($user && ProfilePhotoVisibility::canView($viewer, $user), 403);
        $path = $user->getAttributes()['profile_photo_path'] ?? null;
        abort_unless($path && basename($path) === $version && str_starts_with($path, 'profile-photos/') && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, max-age=3600', 'X-Content-Type-Options' => 'nosniff']);
    }

    private function requireSchema(): void
    {
        abort_unless(Schema::hasColumn('users', 'profile_photo_path') && Schema::hasColumn('users', 'notification_preferences'), 503,
            'Account photo and preferences setup is pending. Please contact the administrator.');
    }
}
