<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClearNotificationsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function notify(User $user, int $count = 1, string $type = 'wage_set'): void
    {
        foreach (range(1, $count) as $i) {
            app(NotificationService::class)->send($user, $type, "Notice {$i}", 'Body');
        }
    }

    /** A homeowner and a project with one worker invited to it; returns [worker, requestId]. */
    private function invitation(User $owner): array
    {
        $worker = $this->user('worker');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House', 'location' => 'Quezon City', 'budget' => 2500000, 'totalEstimate' => 2420000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'durationWeeks' => 26, 'tasks' => ['Pour slab']]],
        ]);

        Sanctum::actingAs($owner);
        $requestId = $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertSuccessful()->json('id');

        return [$worker, $requestId];
    }

    public function test_clear_all_deletes_the_whole_feed_including_what_the_app_does_not_show(): void
    {
        $user = $this->user('worker');
        $this->notify($user, 60);
        Sanctum::actingAs($user);

        // The app lists the newest 50; clearing means all of them.
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(50);

        $this->deleteJson('/api/notifications')->assertOk()->assertJsonPath('cleared', 60)->assertJsonPath('kept', 0);

        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('count', 0);
        $this->assertSame(0, AppNotification::where('user_id', $user->id)->count());
    }

    public function test_clearing_never_touches_anyone_elses_notifications(): void
    {
        $me = $this->user('worker');
        $other = $this->user('worker');
        $this->notify($me, 2);
        $this->notify($other, 3);
        Sanctum::actingAs($me);

        $this->deleteJson('/api/notifications')->assertOk()->assertJsonPath('cleared', 2);

        $this->assertSame(3, AppNotification::where('user_id', $other->id)->count());
    }

    public function test_clearing_an_empty_feed_is_fine(): void
    {
        Sanctum::actingAs($this->user('homeowner'));

        $this->deleteJson('/api/notifications')->assertOk()->assertJsonPath('cleared', 0)->assertJsonPath('kept', 0);
    }

    public function test_an_invite_still_waiting_for_an_answer_survives_clearing(): void
    {
        $owner = $this->user('homeowner');
        [$worker] = $this->invitation($owner);
        $this->notify($worker, 3);

        Sanctum::actingAs($worker);
        $this->deleteJson('/api/notifications')->assertOk()->assertJsonPath('cleared', 3)->assertJsonPath('kept', 1);

        $left = $this->getJson('/api/notifications')->assertOk()->assertJsonCount(1)->json('0');
        $this->assertSame('worker_invite', $left['type']);
        $this->assertSame('pending', $left['data']['requestStatus']);
    }

    public function test_an_answered_invite_is_cleared_like_any_other(): void
    {
        $owner = $this->user('homeowner');
        [$worker, $requestId] = $this->invitation($owner);

        Sanctum::actingAs($worker);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])->assertOk();

        $this->deleteJson('/api/notifications')->assertOk()->assertJsonPath('kept', 0);
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
    }

    public function test_clearing_requires_signing_in(): void
    {
        $this->deleteJson('/api/notifications')->assertUnauthorized();
    }
}
