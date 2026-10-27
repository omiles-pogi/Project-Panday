<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\NotificationService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private function homeowner(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'homeowner', 'approval_status' => 'approved'], $overrides));
    }

    private function worker(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'worker', 'approval_status' => 'approved'], $overrides));
    }

    /**
     * @return array<string, mixed>
     */
    private function planPayload(): array
    {
        return [
            'projectTitle' => 'My House Construction',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 7,
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100]],
        ];
    }

    public function test_a_user_can_list_their_own_notifications(): void
    {
        $user = $this->homeowner();
        $other = $this->homeowner();
        $notifications = app(NotificationService::class);
        $notifications->send($user, 'worker_invite', 'Title', 'Body', ['projectId' => 1]);
        $notifications->send($other, 'worker_invite', 'Not yours', 'Body');

        Sanctum::actingAs($user);
        $response = $this->getJson('/api/notifications');

        $response->assertStatus(200)->assertJsonCount(1);
        $response->assertJsonPath('0.title', 'Title')
            ->assertJsonPath('0.isRead', false)
            ->assertJsonPath('0.data.projectId', 1);
    }

    public function test_unread_count_reflects_only_unread_notifications(): void
    {
        $user = $this->homeowner();
        $notifications = app(NotificationService::class);
        $a = $notifications->send($user, 'worker_invite', 'A', 'Body');
        $notifications->send($user, 'worker_invite', 'B', 'Body');

        Sanctum::actingAs($user);
        $this->getJson('/api/notifications/unread-count')->assertStatus(200)->assertJsonPath('count', 2);

        $this->patchJson("/api/notifications/{$a->id}/read")->assertStatus(200)->assertJsonPath('isRead', true);

        $this->getJson('/api/notifications/unread-count')->assertStatus(200)->assertJsonPath('count', 1);
    }

    public function test_a_user_cannot_mark_someone_elses_notification_as_read(): void
    {
        $owner = $this->homeowner();
        $stranger = $this->homeowner();
        $notification = app(NotificationService::class)->send($owner, 'worker_invite', 'Title', 'Body');

        Sanctum::actingAs($stranger);
        $this->patchJson("/api/notifications/{$notification->id}/read")->assertStatus(422);
    }

    public function test_mark_all_read_clears_unread_count(): void
    {
        $user = $this->homeowner();
        $notifications = app(NotificationService::class);
        $notifications->send($user, 'worker_invite', 'A', 'Body');
        $notifications->send($user, 'worker_invite', 'B', 'Body');

        Sanctum::actingAs($user);
        $this->postJson('/api/notifications/read-all')->assertStatus(204);

        $this->getJson('/api/notifications/unread-count')->assertStatus(200)->assertJsonPath('count', 0);
    }

    public function test_notifications_require_authentication(): void
    {
        $this->getJson('/api/notifications')->assertStatus(401);
        $this->getJson('/api/notifications/unread-count')->assertStatus(401);
    }

    public function test_a_notifications_request_status_reflects_the_live_request_state(): void
    {
        $owner = $this->homeowner();
        $worker = $this->worker();
        $project = app(ProjectService::class)->createFromPlan($owner, $this->planPayload());

        Sanctum::actingAs($owner);
        $requestId = $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->json('id');

        Sanctum::actingAs($worker);
        $this->getJson('/api/notifications')->assertJsonPath('0.data.requestStatus', 'pending');

        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])->assertStatus(200);

        // Same notification, re-fetched — its action buttons should disappear client-side once
        // this flips away from "pending", since the request itself is now resolved.
        $this->getJson('/api/notifications')->assertJsonPath('0.data.requestStatus', 'approved');
    }

    public function test_a_user_can_delete_their_own_notification(): void
    {
        $user = $this->homeowner();
        $notification = app(NotificationService::class)->send($user, 'worker_invite', 'Title', 'Body');

        Sanctum::actingAs($user);
        $this->deleteJson("/api/notifications/{$notification->id}")->assertStatus(204);

        $this->assertDatabaseMissing('app_notifications', ['id' => $notification->id]);
    }

    public function test_a_user_cannot_delete_someone_elses_notification(): void
    {
        $owner = $this->homeowner();
        $stranger = $this->homeowner();
        $notification = app(NotificationService::class)->send($owner, 'worker_invite', 'Title', 'Body');

        Sanctum::actingAs($stranger);
        $this->deleteJson("/api/notifications/{$notification->id}")->assertStatus(422);

        $this->assertDatabaseHas('app_notifications', ['id' => $notification->id]);
    }

    public function test_deleting_a_notification_requires_authentication(): void
    {
        $notification = app(NotificationService::class)->send($this->homeowner(), 'worker_invite', 'Title', 'Body');

        $this->deleteJson("/api/notifications/{$notification->id}")->assertStatus(401);
    }
}
