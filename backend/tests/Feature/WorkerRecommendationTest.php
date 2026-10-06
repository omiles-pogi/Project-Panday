<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkerRecommendationTest extends TestCase
{
    use RefreshDatabase;

    private function worker(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'worker',
            'approval_status' => 'approved',
        ], $overrides));
    }

    private function homeowner(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'homeowner',
            'approval_status' => 'approved',
        ], $overrides));
    }

    public function test_a_worker_can_create_and_update_their_profile(): void
    {
        $worker = $this->worker();
        Sanctum::actingAs($worker);

        $response = $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 5,
            'bio' => 'Experienced mason specializing in concrete work.',
            'skills' => ['Concrete Work', 'Bricklaying', 'Tiling'],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('trade', 'Mason')
            ->assertJsonPath('years_experience', 5)
            ->assertJsonCount(3, 'skills');

        $this->assertDatabaseHas('worker_profiles', ['user_id' => $worker->id, 'trade' => 'Mason']);
        $this->assertDatabaseCount('worker_skills', 3);
    }

    public function test_updating_a_profile_replaces_the_old_skill_list(): void
    {
        $worker = $this->worker();
        Sanctum::actingAs($worker);

        $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 5,
            'skills' => ['Concrete Work', 'Bricklaying'],
        ])->assertStatus(200);

        $response = $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 6,
            'skills' => ['Tiling'],
        ]);

        $response->assertStatus(200)->assertJsonCount(1, 'skills');
        $this->assertDatabaseCount('worker_skills', 1);
        $this->assertDatabaseHas('worker_skills', ['skill' => 'Tiling']);
    }

    public function test_only_a_worker_role_can_set_a_worker_profile(): void
    {
        Sanctum::actingAs($this->homeowner());

        $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 5,
            'skills' => ['Concrete Work'],
        ])->assertStatus(403);
    }

    public function test_search_ranks_closer_trade_and_skill_matches_higher(): void
    {
        $mason = $this->worker(['name' => 'Mason Worker']);
        Sanctum::actingAs($mason);
        $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 10,
            'skills' => ['Concrete Work', 'Bricklaying', 'Tiling'],
        ])->assertStatus(200);

        $electrician = $this->worker(['name' => 'Electrician Worker']);
        Sanctum::actingAs($electrician);
        $this->putJson('/api/worker-profile', [
            'trade' => 'Electrician',
            'years_experience' => 3,
            'skills' => ['Wiring'],
        ])->assertStatus(200);

        Sanctum::actingAs($this->homeowner());
        $response = $this->getJson('/api/workers?trade=Mason&skills[]=Concrete+Work&skills[]=Tiling');

        $response->assertStatus(200)->assertJsonCount(2);
        $names = collect($response->json())->pluck('name');
        $this->assertSame('Mason Worker', $names->first());
    }

    public function test_search_excludes_workers_without_a_profile(): void
    {
        $this->worker(); // no profile set
        Sanctum::actingAs($this->homeowner());

        $response = $this->getJson('/api/workers');

        $response->assertStatus(200)->assertJsonCount(0);
    }

    public function test_search_excludes_unapproved_workers(): void
    {
        // A valid token works regardless of approval_status (that's only enforced at
        // login), so a pending worker can still set up their profile here.
        $pendingWorker = $this->worker(['approval_status' => 'pending']);
        Sanctum::actingAs($pendingWorker);
        $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 5,
            'skills' => ['Concrete Work'],
        ])->assertStatus(200);

        Sanctum::actingAs($this->homeowner());
        $response = $this->getJson('/api/workers');

        $response->assertStatus(200)->assertJsonCount(0);
    }

    public function test_a_homeowner_can_rate_a_worker(): void
    {
        $worker = $this->worker();
        Sanctum::actingAs($this->homeowner());

        $response = $this->postJson("/api/workers/{$worker->id}/ratings", [
            'score' => 5,
            'comment' => 'Great work!',
        ]);

        $response->assertStatus(201)->assertJsonPath('score', 5);
        $this->assertDatabaseHas('worker_ratings', ['worker_id' => $worker->id, 'score' => 5]);
    }

    public function test_a_worker_cannot_rate_themselves(): void
    {
        $worker = $this->worker();
        Sanctum::actingAs($worker);

        $this->postJson("/api/workers/{$worker->id}/ratings", ['score' => 5])->assertStatus(422);
    }

    public function test_only_workers_can_be_rated(): void
    {
        $target = $this->homeowner();
        Sanctum::actingAs($this->homeowner());

        $this->postJson("/api/workers/{$target->id}/ratings", ['score' => 5])->assertStatus(422);
    }

    public function test_viewing_a_worker_profile_includes_average_rating(): void
    {
        $worker = $this->worker();
        Sanctum::actingAs($worker);
        $this->putJson('/api/worker-profile', [
            'trade' => 'Mason',
            'years_experience' => 5,
            'skills' => ['Concrete Work'],
        ])->assertStatus(200);

        Sanctum::actingAs($this->homeowner());
        $this->postJson("/api/workers/{$worker->id}/ratings", ['score' => 4])->assertStatus(201);

        Sanctum::actingAs($this->homeowner());
        $this->postJson("/api/workers/{$worker->id}/ratings", ['score' => 5])->assertStatus(201);

        Sanctum::actingAs($this->homeowner());
        $response = $this->getJson("/api/workers/{$worker->id}");

        $response->assertStatus(200)
            ->assertJsonPath('averageRating', 4.5)
            ->assertJsonPath('ratingCount', 2);
    }

    public function test_worker_endpoints_require_authentication(): void
    {
        $this->getJson('/api/workers')->assertStatus(401);
        $this->putJson('/api/worker-profile', [])->assertStatus(401);
    }
}
