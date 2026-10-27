<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\ProjectContractorRequest;
use App\Models\ProjectWorkerRequest;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class NotificationService
{
    /** Notification types that carry a request the recipient can still act on — and which table
     * to check for its current status, since the notification's own `data` is frozen at the
     * moment it was created and never reflects a later accept/decline/approve/reject. */
    private const ACTIONABLE_REQUEST_MODEL = [
        'worker_invite' => ProjectWorkerRequest::class,
        'worker_application' => ProjectWorkerRequest::class,
        'contractor_invite' => ProjectContractorRequest::class,
        'contractor_application' => ProjectContractorRequest::class,
    ];

    /**
     * @param  array<string, mixed>  $data
     */
    public function send(User $recipient, string $type, string $title, string $body, array $data = []): AppNotification
    {
        return AppNotification::create([
            'user_id' => $recipient->id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);
    }

    public function unreadCountFor(User $user): int
    {
        return $user->appNotifications()->whereNull('read_at')->count();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function listFor(User $user, int $limit = 50): Collection
    {
        return $user->appNotifications()->limit($limit)->get()->map(fn (AppNotification $n) => $this->present($n));
    }

    public function markRead(AppNotification $notification, User $actingUser): AppNotification
    {
        $this->authorize($notification, $actingUser);

        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return $notification;
    }

    public function markAllRead(User $user): void
    {
        $user->appNotifications()->whereNull('read_at')->update(['read_at' => now()]);
    }

    public function delete(AppNotification $notification, User $actingUser): void
    {
        $this->authorize($notification, $actingUser);

        $notification->delete();
    }

    private function authorize(AppNotification $notification, User $actingUser): void
    {
        if ($notification->user_id !== $actingUser->id) {
            throw ValidationException::withMessages(['notification_id' => 'This notification is not yours.']);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function present(AppNotification $n): array
    {
        return [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'data' => $this->liveData($n),
            'isRead' => $n->read_at !== null,
            'createdAt' => $n->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function liveData(AppNotification $n): array
    {
        $data = $n->data ?? [];
        $requestId = $data['requestId'] ?? null;
        $modelClass = self::ACTIONABLE_REQUEST_MODEL[$n->type] ?? null;

        if ($requestId && $modelClass) {
            $data['requestStatus'] = $modelClass::find($requestId)?->status;
        }

        return $data;
    }
}
