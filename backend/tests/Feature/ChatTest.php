<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\Project;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'Dela Cruz Residence',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 7,
            'phases' => [['name' => 'Foundation', 'percentComplete' => 0]],
        ]);
    }

    /** @return array{0: User, 1: User, 2: Project} */
    private function assignedPair(): array
    {
        $homeowner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = $this->project($homeowner);
        $project->contractors()->attach($contractor->id);

        return [$homeowner, $contractor, $project];
    }

    private function startAs(User $user, Project $project, ?User $contractor = null): int
    {
        Sanctum::actingAs($user);
        $payload = ['project_id' => $project->id];
        if ($contractor) {
            $payload['contractor_id'] = $contractor->id;
        }

        return $this->postJson('/api/conversations', $payload)->assertStatus(200)->json('id');
    }

    public function test_homeowner_and_assigned_contractor_can_exchange_messages(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();

        $id = $this->startAs($homeowner, $project, $contractor);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'When can you start the foundation?'])
            ->assertStatus(201)
            ->assertJsonPath('isMine', true)
            ->assertJsonPath('senderName', $homeowner->name);

        // The contractor opening "Message Homeowner" on the same project lands in the same thread.
        $this->assertSame($id, $this->startAs($contractor, $project));
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Next Monday.'])->assertStatus(201);

        $history = $this->getJson("/api/conversations/{$id}/messages")->assertStatus(200);
        $history->assertJsonCount(2)
            ->assertJsonPath('0.body', 'When can you start the foundation?')
            ->assertJsonPath('0.isMine', false)
            ->assertJsonPath('1.body', 'Next Monday.')
            ->assertJsonPath('1.isMine', true);

        $this->assertDatabaseCount('messages', 2);
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_starting_twice_never_creates_a_duplicate_conversation(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();

        $first = $this->startAs($homeowner, $project, $contractor);
        $second = $this->startAs($homeowner, $project, $contractor);

        $this->assertSame($first, $second);
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_a_retried_send_with_the_same_client_key_is_not_duplicated(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);

        $a = $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Hello', 'client_key' => 'k-1'])->assertStatus(201)->json('id');
        $b = $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Hello', 'client_key' => 'k-1'])->assertStatus(201)->json('id');

        $this->assertSame($a, $b);
        $this->assertDatabaseCount('messages', 1);
    }

    public function test_polling_with_after_id_returns_only_newer_messages_in_order(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);

        $first = $this->postJson("/api/conversations/{$id}/messages", ['body' => 'one'])->json('id');
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'two']);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'three']);

        $this->getJson("/api/conversations/{$id}/messages?after_id={$first}")
            ->assertStatus(200)
            ->assertJsonCount(2)
            ->assertJsonPath('0.body', 'two')
            ->assertJsonPath('1.body', 'three');
    }

    public function test_unread_counts_update_and_clear_when_read(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Ping 1']);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Ping 2']);

        // The sender's own messages never count as unread for them.
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 0);

        Sanctum::actingAs($contractor);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 2);
        $this->getJson('/api/conversations')
            ->assertStatus(200)
            ->assertJsonPath('0.unreadCount', 2)
            ->assertJsonPath('0.lastMessage.body', 'Ping 2')
            ->assertJsonPath('0.otherParticipant.name', $homeowner->name)
            ->assertJsonPath('0.project.title', 'Dela Cruz Residence');

        $this->postJson("/api/conversations/{$id}/read")->assertStatus(200)->assertJsonPath('marked', 2);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 0);
    }

    public function test_an_unassigned_contractor_cannot_start_a_conversation(): void
    {
        $homeowner = $this->user('homeowner');
        $project = $this->project($homeowner);
        $stranger = $this->user('contractor');

        Sanctum::actingAs($stranger);
        $this->postJson('/api/conversations', ['project_id' => $project->id])->assertStatus(422);

        Sanctum::actingAs($homeowner);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'contractor_id' => $stranger->id])->assertStatus(422);

        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_a_homeowner_cannot_open_a_thread_on_someone_elses_project(): void
    {
        [, $contractor, $project] = $this->assignedPair();

        Sanctum::actingAs($this->user('homeowner'));
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'contractor_id' => $contractor->id])->assertStatus(422);
    }

    public function test_outsiders_cannot_read_send_or_mark_read_by_guessing_ids(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Private'])->assertStatus(201);

        foreach ([$this->user('homeowner'), $this->user('contractor'), $this->user('worker')] as $outsider) {
            Sanctum::actingAs($outsider);
            $this->getJson("/api/conversations/{$id}")->assertStatus(422);
            $this->getJson("/api/conversations/{$id}/messages")->assertStatus(422);
            $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Hi'])->assertStatus(422);
            $this->postJson("/api/conversations/{$id}/read")->assertStatus(422);
            $this->getJson('/api/conversations')->assertStatus(200)->assertJsonCount(0);
        }

        $this->assertDatabaseCount('messages', 1);
        $this->assertNull(Message::first()->read_at);
    }

    public function test_suppliers_cannot_use_chat(): void
    {
        Sanctum::actingAs($this->user('supplier'));
        $this->getJson('/api/conversations')->assertStatus(403);
    }

    public function test_empty_and_overlong_messages_are_rejected(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);

        $this->postJson("/api/conversations/{$id}/messages", ['body' => ''])->assertStatus(422);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => '    '])->assertStatus(422);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => str_repeat('a', 2001)])->assertStatus(422);
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_history_stays_readable_but_read_only_after_the_contractor_is_unassigned(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Before'])->assertStatus(201);

        $project->contractors()->detach($contractor->id);

        Sanctum::actingAs($contractor);
        $this->getJson("/api/conversations/{$id}/messages")->assertStatus(200)->assertJsonCount(1);
        $this->getJson("/api/conversations/{$id}")->assertStatus(200)->assertJsonPath('canSend', false);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'After'])->assertStatus(422);
    }

    public function test_worker_and_homeowner_can_start_the_same_thread_and_exchange_messages(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);

        $id = $this->startAs($worker, $project);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'When should I arrive?', 'client_key' => 'worker-1'])
            ->assertCreated()->assertJsonPath('senderRole', 'worker');
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'When should I arrive?', 'client_key' => 'worker-1'])
            ->assertCreated();
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 0);

        Sanctum::actingAs($homeowner);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id])
            ->assertOk()->assertJsonPath('id', $id)->assertJsonPath('otherParticipant.role', 'worker');
        $this->getJson('/api/conversations')->assertOk()->assertJsonPath('0.unreadCount', 1);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 1);
        $this->postJson("/api/conversations/{$id}/read")->assertOk()->assertJsonPath('marked', 1);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 0);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'At 8 AM.'])->assertCreated();

        Sanctum::actingAs($worker);
        $this->getJson('/api/conversations')->assertOk()->assertJsonPath('0.otherParticipant.id', $homeowner->id);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 1);
        $this->getJson("/api/conversations/{$id}/messages")->assertOk()->assertJsonCount(2)->assertJsonPath('1.body', 'At 8 AM.');

        Sanctum::actingAs($contractor);
        $this->getJson("/api/conversations/{$id}")->assertStatus(422);
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_assigned_contractor_and_worker_can_start_the_same_thread_from_either_side(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);

        Sanctum::actingAs($contractor);
        $id = $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id])
            ->assertOk()->assertJsonPath('otherParticipant.id', $worker->id)->json('id');
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Please check the foundation.'])->assertCreated();

        $this->assertSame($id, $this->startAs($worker, $project, $contractor));
        $this->getJson('/api/conversations')->assertOk()->assertJsonPath('0.otherParticipant.id', $contractor->id);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 1);
        $this->postJson("/api/conversations/{$id}/read")->assertOk()->assertJsonPath('marked', 1);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Done.'])->assertCreated();

        foreach ([$homeowner, $this->user('worker'), $this->user('contractor')] as $outsider) {
            Sanctum::actingAs($outsider);
            $this->getJson("/api/conversations/{$id}")->assertStatus(422);
            $this->getJson("/api/conversations/{$id}/messages")->assertStatus(422);
            $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Private?'])->assertStatus(422);
            $this->postJson("/api/conversations/{$id}/read")->assertStatus(422);
            $this->getJson('/api/conversations')->assertOk()->assertJsonCount(0);
            $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 0);
        }
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_unassigned_workers_and_contractors_cannot_start_worker_threads(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');

        Sanctum::actingAs($worker);
        $this->postJson('/api/conversations', ['project_id' => $project->id])->assertStatus(422);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'contractor_id' => $contractor->id])->assertStatus(422);

        foreach ([$homeowner, $contractor] as $user) {
            Sanctum::actingAs($user);
            $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id])->assertStatus(422);
        }

        $project->workers()->attach($worker->id);
        Sanctum::actingAs($worker);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'contractor_id' => $this->user('contractor')->id])->assertStatus(422);
        Sanctum::actingAs($this->user('contractor'));
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id])->assertStatus(422);
        Sanctum::actingAs($this->user('homeowner'));
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id])->assertStatus(422);

        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_workers_cannot_impersonate_other_workers_or_create_three_person_threads(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $otherWorker = $this->user('worker');
        $project->workers()->attach([$worker->id, $otherWorker->id]);

        Sanctum::actingAs($worker);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $otherWorker->id])->assertStatus(422);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'contractor_id' => $homeowner->id])->assertStatus(422);

        Sanctum::actingAs($homeowner);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id, 'contractor_id' => $contractor->id])->assertStatus(422);
        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_worker_threads_stay_readable_but_cannot_send_after_worker_is_unassigned(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);
        $ownerThread = $this->startAs($worker, $project);
        $contractorThread = $this->startAs($worker, $project, $contractor);
        foreach ([$ownerThread, $contractorThread] as $id) {
            $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Before'])->assertCreated();
        }

        $project->workers()->detach($worker->id);
        foreach ([[$ownerThread, $homeowner], [$contractorThread, $contractor]] as [$id, $other]) {
            foreach ([$worker, $other] as $participant) {
                Sanctum::actingAs($participant);
                $this->getJson("/api/conversations/{$id}")->assertOk()->assertJsonPath('canSend', false);
                $this->getJson("/api/conversations/{$id}/messages")->assertOk()->assertJsonCount(1);
                $this->postJson("/api/conversations/{$id}/messages", ['body' => 'After'])->assertStatus(422);
                $this->postJson("/api/conversations/{$id}/read")->assertOk();
            }
        }
    }

    public function test_contractor_worker_thread_becomes_read_only_after_contractor_leaves(): void
    {
        [, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);
        $id = $this->startAs($worker, $project, $contractor);
        $project->contractors()->detach($contractor->id);

        foreach ([$worker, $contractor] as $participant) {
            Sanctum::actingAs($participant);
            $this->getJson("/api/conversations/{$id}")->assertOk()->assertJsonPath('canSend', false);
            $this->postJson("/api/conversations/{$id}/messages", ['body' => 'After'])->assertStatus(422);
        }
    }

    public function test_project_threads_are_separate_for_each_pair_and_project(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);
        $ownerContractor = $this->startAs($homeowner, $project, $contractor);
        $ownerWorker = $this->startAs($worker, $project);
        $contractorWorker = $this->startAs($worker, $project, $contractor);

        $otherProject = $this->project($homeowner);
        $otherProject->workers()->attach($worker->id);
        $otherOwnerWorker = $this->startAs($worker, $otherProject);
        $this->assertCount(4, array_unique([$ownerContractor, $ownerWorker, $contractorWorker, $otherOwnerWorker]));
        $this->assertDatabaseCount('conversations', 4);
    }

    public function test_new_messages_notify_only_the_recipient_for_every_chat_pair(): void
    {
        foreach (['homeowner-contractor', 'homeowner-worker', 'contractor-worker'] as $pair) {
            [$homeowner, $contractor, $project] = $this->assignedPair();
            $worker = $this->user('worker');
            $project->workers()->attach($worker->id);

            if ($pair === 'homeowner-contractor') {
                $sender = $homeowner;
                $recipient = $contractor;
                $id = $this->startAs($homeowner, $project, $contractor);
            } else {
                $sender = $worker;
                $recipient = $pair === 'homeowner-worker' ? $homeowner : $contractor;
                $id = $this->startAs($worker, $project, $pair === 'homeowner-worker' ? null : $contractor);
            }

            $messageId = $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Please check the plans.'])
                ->assertCreated()->json('id');
            $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);

            Sanctum::actingAs($recipient);
            $this->getJson('/api/notifications')->assertOk()->assertJsonCount(1)
                ->assertJsonPath('0.type', 'new_message')
                ->assertJsonPath('0.title', "New message from {$sender->name}")
                ->assertJsonPath('0.body', 'Please check the plans.')
                ->assertJsonPath('0.data.conversationId', $id)
                ->assertJsonPath('0.data.messageId', $messageId)
                ->assertJsonPath('0.data.projectId', $project->id)
                ->assertJsonPath('0.data.projectTitle', $project->title)
                ->assertJsonPath('0.data.senderId', $sender->id)
                ->assertJsonPath('0.isRead', false);
            $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 1);

            $this->postJson("/api/conversations/{$id}/messages", ['body' => 'On it.'])->assertCreated();
            Sanctum::actingAs($sender);
            $this->getJson('/api/notifications')->assertOk()->assertJsonCount(1)
                ->assertJsonPath('0.data.senderId', $recipient->id);
            Sanctum::actingAs($this->user('worker'));
            $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
        }
    }

    public function test_retrying_a_message_does_not_duplicate_or_restore_its_notification(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);
        $payload = ['body' => 'Hello', 'client_key' => 'notify-once'];
        $this->postJson("/api/conversations/{$id}/messages", $payload)->assertCreated();
        $this->postJson("/api/conversations/{$id}/messages", $payload)->assertCreated();
        $this->assertDatabaseCount('app_notifications', 1);

        Sanctum::actingAs($contractor);
        $notificationId = $this->getJson('/api/notifications')->json('0.id');
        $this->deleteJson("/api/notifications/{$notificationId}")->assertNoContent();

        Sanctum::actingAs($homeowner);
        $this->postJson("/api/conversations/{$id}/messages", $payload)->assertCreated();
        $this->assertDatabaseCount('app_notifications', 0);
        $this->assertDatabaseCount('messages', 1);
    }

    public function test_reading_chat_clears_only_its_recipient_notifications(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $worker = $this->user('worker');
        $project->workers()->attach($worker->id);
        $contractorThread = $this->startAs($contractor, $project);
        $this->postJson("/api/conversations/{$contractorThread}/messages", ['body' => 'First'])->assertCreated();
        $this->postJson("/api/conversations/{$contractorThread}/messages", ['body' => 'Second'])->assertCreated();
        $workerThread = $this->startAs($worker, $project);
        $this->postJson("/api/conversations/{$workerThread}/messages", ['body' => 'Another thread'])->assertCreated();
        app(NotificationService::class)->send($homeowner, 'worker_invite', 'Other notification', 'Keep unread');

        Sanctum::actingAs($homeowner);
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 4);
        $this->postJson("/api/conversations/{$contractorThread}/messages", ['body' => 'Thanks'])->assertCreated();
        $this->postJson("/api/conversations/{$contractorThread}/read")->assertOk()->assertJsonPath('marked', 2);
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 2);
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 1);
        $notifications = $this->getJson('/api/notifications')->assertOk()->json();
        $read = collect($notifications)->filter(fn ($n) => ($n['data']['conversationId'] ?? null) === $contractorThread);
        $this->assertCount(2, $read);
        $this->assertTrue($read->every(fn ($n) => $n['isRead']));
        $this->postJson("/api/conversations/{$contractorThread}/read")->assertOk()->assertJsonPath('marked', 0);
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 2);

        Sanctum::actingAs($contractor);
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 1);
        $this->postJson("/api/conversations/{$contractorThread}/read")->assertOk()->assertJsonPath('marked', 1);
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 0);
    }

    public function test_long_messages_have_a_short_notification_preview(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $homeowner->update(['name' => str_repeat('A', 255)]);
        $id = $this->startAs($homeowner, $project, $contractor);
        $body = str_repeat('a', 2000);
        $this->postJson("/api/conversations/{$id}/messages", ['body' => $body])
            ->assertCreated()->assertJsonPath('body', $body);

        Sanctum::actingAs($contractor);
        $notification = $this->getJson('/api/notifications')->assertOk()->json('0');
        $this->assertLessThanOrEqual(255, mb_strlen($notification['title']));
        $this->assertLessThanOrEqual(255, mb_strlen($notification['body']));
        $this->assertStringStartsWith(str_repeat('a', 100), $notification['body']);
    }

    public function test_message_is_rolled_back_if_notification_cannot_be_saved(): void
    {
        [$homeowner, $contractor, $project] = $this->assignedPair();
        $id = $this->startAs($homeowner, $project, $contractor);
        $this->mock(NotificationService::class)->shouldReceive('send')->once()
            ->andThrow(new \RuntimeException('notification storage failed'));
        $this->withoutExceptionHandling();

        try {
            $this->postJson("/api/conversations/{$id}/messages", ['body' => 'Atomic send']);
            $this->fail('Expected the notification storage failure.');
        } catch (\RuntimeException $e) {
            $this->assertSame('notification storage failed', $e->getMessage());
        }

        $this->assertDatabaseCount('messages', 0);
        $this->assertDatabaseCount('app_notifications', 0);
        $this->assertDatabaseHas('conversations', ['id' => $id, 'last_message_at' => null]);
    }

    public function test_guests_cannot_access_chat(): void
    {
        $this->getJson('/api/conversations')->assertStatus(401);
    }
}
