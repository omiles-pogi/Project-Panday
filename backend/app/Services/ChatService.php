<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Private project messaging; starting and sending require both participants to remain assigned. */
class ChatService
{
    /** Newest messages returned when a thread is first opened. */
    private const HISTORY_LIMIT = 200;

    public function __construct(private readonly NotificationService $notifications) {}

    /**
     * The user's inbox, most recently active first.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function listFor(User $user): Collection
    {
        return $this->participantQuery($user)
            ->with(['project:id,title,user_id', 'project.contractors:id', 'project.workers:id', 'homeowner:id,name,role', 'contractor:id,name,role', 'worker:id,name,role', 'latestMessage'])
            ->withCount(['messages as unread_count' => fn (Builder $q) => $q->where('sender_id', '!=', $user->id)->whereNull('read_at')])
            ->orderByRaw('COALESCE(last_message_at, created_at) DESC')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Conversation $c) => $this->present($c, $user));
    }

    public function unreadCountFor(User $user): int
    {
        return Message::query()
            ->whereIn('conversation_id', $this->participantQuery($user)->select('id'))
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();
    }

    /** Opens or reuses a private project thread, with unique indexes preventing concurrent duplicates.
     *
     * @return array<string, mixed>
     */
    public function start(User $actingUser, Project $project, ?int $contractorId, ?int $workerId = null): array
    {
        $project->load(['contractors:id,role', 'workers:id,role']);
        $homeownerId = null;

        if ($actingUser->role === 'homeowner') {
            if (! $project->isOwnedBy($actingUser)) {
                throw ValidationException::withMessages(['project_id' => 'This is not your project.']);
            }
            $homeownerId = $actingUser->id;
            if ($workerId !== null) {
                $contractorId = null;
            } elseif (! $contractorId) {
                throw ValidationException::withMessages(['contractor_id' => 'Choose a contractor or worker assigned to this project.']);
            }
        } elseif ($actingUser->role === 'contractor') {
            if (! $project->hasAssignedContractor($actingUser)) {
                throw ValidationException::withMessages(['project_id' => 'You are not assigned to this project.']);
            }
            $contractorId = $actingUser->id;
            $homeownerId = $workerId === null ? $project->user_id : null;
        } elseif ($actingUser->role === 'worker') {
            if (! $project->hasAssignedWorker($actingUser)) {
                throw ValidationException::withMessages(['project_id' => 'You are not assigned to this project.']);
            }
            if ($workerId !== null) {
                throw ValidationException::withMessages(['worker_id' => 'Workers may message the homeowner or an assigned contractor.']);
            }
            $workerId = $actingUser->id;
            $homeownerId = $contractorId === null ? $project->user_id : null;
        } else {
            throw ValidationException::withMessages(['role' => 'Only project participants can message about a project.']);
        }

        if ($contractorId !== null && ! $project->contractors->contains(fn (User $user) => $user->id === $contractorId && $user->role === 'contractor')) {
            throw ValidationException::withMessages(['contractor_id' => 'That contractor is not assigned to this project.']);
        }
        if ($workerId !== null && ! $project->workers->contains(fn (User $user) => $user->id === $workerId && $user->role === 'worker')) {
            throw ValidationException::withMessages(['worker_id' => 'That worker is not assigned to this project.']);
        }

        $conversation = Conversation::createOrFirst([
            'project_id' => $project->id,
            'homeowner_id' => $homeownerId,
            'contractor_id' => $contractorId,
            'worker_id' => $workerId,
        ]);

        return $this->present($this->loadForPresent($conversation, $actingUser), $actingUser);
    }

    /** @return array<string, mixed> */
    public function show(Conversation $conversation, User $actingUser): array
    {
        $this->authorizeParticipant($conversation, $actingUser);

        return $this->present($this->loadForPresent($conversation, $actingUser), $actingUser);
    }

    /**
     * Thread history in ascending order. With $afterId, only messages newer than it — what the
     * client polls with, so each poll returns just the delta and never re-sends what it has.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function messagesFor(Conversation $conversation, User $actingUser, ?int $afterId = null): Collection
    {
        $this->authorizeParticipant($conversation, $actingUser);

        $query = $conversation->messages()->with('sender:id,name,role');

        $messages = $afterId !== null
            ? $query->where('id', '>', $afterId)->orderBy('id')->limit(self::HISTORY_LIMIT)->get()
            : $query->orderByDesc('id')->limit(self::HISTORY_LIMIT)->get()->reverse()->values();

        return $messages->map(fn (Message $m) => $this->presentMessage($m, $actingUser));
    }

    /** @return array<string, mixed> */
    public function send(Conversation $conversation, User $sender, string $body, ?string $clientKey): array
    {
        $this->authorizeParticipant($conversation, $sender);

        if (! $this->canSend($conversation)) {
            throw ValidationException::withMessages(['conversation_id' => 'A participant is no longer assigned to this project, so this conversation is read-only.']);
        }

        if ($clientKey !== null && ($existing = $this->findByClientKey($conversation, $sender, $clientKey))) {
            return $this->presentMessage($existing->load('sender:id,name,role'), $sender);
        }

        return DB::transaction(function () use ($conversation, $sender, $body, $clientKey) {
            // createOrFirst also handles concurrent retries, without notifying twice.
            $message = $conversation->messages()->createOrFirst([
                'sender_id' => $sender->id,
                'client_key' => $clientKey,
            ], ['body' => $body]);

            if ($message->wasRecentlyCreated) {
                $conversation->update(['last_message_at' => $message->created_at]);
                $this->notifications->send(
                    User::findOrFail($conversation->otherParticipantId($sender)),
                    'new_message',
                    Str::limit("New message from {$sender->name}", 252),
                    Str::limit($body, 180),
                    [
                        'conversationId' => $conversation->id,
                        'messageId' => $message->id,
                        'projectId' => $conversation->project_id,
                        'projectTitle' => $conversation->project->title,
                        'senderId' => $sender->id,
                        'senderName' => $sender->name,
                    ],
                );
            }

            return $this->presentMessage($message->load('sender:id,name,role'), $sender);
        });
    }

    /** Marks incoming messages and their notifications read together. */
    public function markRead(Conversation $conversation, User $actingUser): int
    {
        $this->authorizeParticipant($conversation, $actingUser);

        return DB::transaction(function () use ($conversation, $actingUser) {
            // Bound both updates to the same messages so a concurrent arrival stays unread.
            $lastMessageId = $conversation->messages()->max('id') ?? 0;
            $readAt = now();
            $marked = $conversation->messages()
                ->where('id', '<=', $lastMessageId)
                ->where('sender_id', '!=', $actingUser->id)
                ->whereNull('read_at')
                ->update(['read_at' => $readAt]);

            $actingUser->appNotifications()
                ->where('type', 'new_message')
                ->where('data->conversationId', $conversation->id)
                ->where('data->messageId', '<=', $lastMessageId)
                ->whereNull('read_at')
                ->update(['read_at' => $readAt]);

            return $marked;
        });
    }

    private function participantQuery(User $user): Builder
    {
        return Conversation::query()->where(
            fn (Builder $q) => $q->where('homeowner_id', $user->id)->orWhere('contractor_id', $user->id)->orWhere('worker_id', $user->id)
        );
    }

    private function findByClientKey(Conversation $conversation, User $sender, string $clientKey): ?Message
    {
        return $conversation->messages()
            ->where('sender_id', $sender->id)
            ->where('client_key', $clientKey)
            ->first();
    }

    /** History remains readable after either participant leaves the project. */
    private function canSend(Conversation $conversation): bool
    {
        $conversation->loadMissing(['project.contractors:id', 'project.workers:id']);
        $project = $conversation->project;

        return $project !== null
            && ($conversation->homeowner_id === null || $project->user_id === $conversation->homeowner_id)
            && ($conversation->contractor_id === null || $project->contractors->contains('id', $conversation->contractor_id))
            && ($conversation->worker_id === null || $project->workers->contains('id', $conversation->worker_id));
    }

    private function authorizeParticipant(Conversation $conversation, User $actingUser): void
    {
        if (! $conversation->hasParticipant($actingUser)) {
            throw ValidationException::withMessages(['conversation_id' => 'This conversation is not yours.']);
        }
    }

    private function loadForPresent(Conversation $conversation, User $viewer): Conversation
    {
        return $conversation
            ->load(['project:id,title,user_id', 'project.contractors:id', 'project.workers:id', 'homeowner:id,name,role', 'contractor:id,name,role', 'worker:id,name,role', 'latestMessage'])
            ->loadCount(['messages as unread_count' => fn (Builder $q) => $q->where('sender_id', '!=', $viewer->id)->whereNull('read_at')]);
    }

    /** @return array<string, mixed> */
    private function present(Conversation $conversation, User $viewer): array
    {
        $other = collect([$conversation->homeowner, $conversation->contractor, $conversation->worker])
            ->first(fn (?User $user) => $user !== null && $user->id !== $viewer->id);
        $last = $conversation->latestMessage;

        return [
            'id' => $conversation->id,
            'project' => $conversation->project ? ['id' => $conversation->project->id, 'title' => $conversation->project->title] : null,
            'otherParticipant' => ['id' => $other->id, 'name' => $other->name, 'role' => $other->role],
            'lastMessage' => $last ? [
                'body' => $last->body,
                'senderId' => $last->sender_id,
                'isMine' => $last->sender_id === $viewer->id,
                'createdAt' => $last->created_at->toIso8601String(),
            ] : null,
            'lastMessageAt' => ($conversation->last_message_at ?? $conversation->created_at)->toIso8601String(),
            'unreadCount' => (int) $conversation->unread_count,
            'canSend' => $this->canSend($conversation),
        ];
    }

    /** @return array<string, mixed> */
    private function presentMessage(Message $message, User $viewer): array
    {
        return [
            'id' => $message->id,
            'conversationId' => $message->conversation_id,
            'senderId' => $message->sender_id,
            'senderName' => $message->sender->name,
            'senderRole' => $message->sender->role,
            'body' => $message->body,
            'clientKey' => $message->client_key,
            'isMine' => $message->sender_id === $viewer->id,
            'readAt' => $message->read_at?->toIso8601String(),
            'createdAt' => $message->created_at->toIso8601String(),
        ];
    }
}
