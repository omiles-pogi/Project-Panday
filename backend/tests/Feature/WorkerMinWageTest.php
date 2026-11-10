<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkerMinWageTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    /** @return array<string, mixed> */
    private function profile(array $overrides = []): array
    {
        return array_merge(['trade' => 'Mason', 'years_experience' => 8, 'bio' => 'Block laying', 'skills' => ['Concrete Work']], $overrides);
    }

    private function workerWithRate(?int $rate = 850): User
    {
        $worker = $this->user('worker');
        Sanctum::actingAs($worker);
        $this->putJson('/api/worker-profile', $this->profile(['min_daily_wage' => $rate]))->assertOk();

        return $worker;
    }

    // ---- setting it ----------------------------------------------------------------------------

    public function test_a_worker_can_set_their_minimum_daily_wage(): void
    {
        $worker = $this->user('worker');
        Sanctum::actingAs($worker);

        $this->putJson('/api/worker-profile', $this->profile(['min_daily_wage' => 850]))
            ->assertOk()
            ->assertJsonPath('min_daily_wage', 850);

        $this->assertDatabaseHas('worker_profiles', ['user_id' => $worker->id, 'min_daily_wage' => 850]);
    }

    public function test_it_is_optional_and_can_be_cleared(): void
    {
        $worker = $this->user('worker');
        Sanctum::actingAs($worker);

        $this->putJson('/api/worker-profile', $this->profile())->assertOk()->assertJsonPath('min_daily_wage', null);
        $this->putJson('/api/worker-profile', $this->profile(['min_daily_wage' => 900]))->assertOk();
        $this->putJson('/api/worker-profile', $this->profile(['min_daily_wage' => null]))->assertOk()->assertJsonPath('min_daily_wage', null);
    }

    public function test_an_older_app_that_does_not_send_it_does_not_wipe_it(): void
    {
        $worker = $this->workerWithRate(850);

        $this->putJson('/api/worker-profile', $this->profile(['bio' => 'Updated bio']))->assertOk()->assertJsonPath('min_daily_wage', 850);
        $this->assertDatabaseHas('worker_profiles', ['user_id' => $worker->id, 'min_daily_wage' => 850, 'bio' => 'Updated bio']);
    }

    public function test_it_must_be_a_sensible_whole_peso_amount(): void
    {
        Sanctum::actingAs($this->user('worker'));

        foreach ([-1, 'lots', 12.5, 1000001] as $bad) {
            $this->putJson('/api/worker-profile', $this->profile(['min_daily_wage' => $bad]))
                ->assertStatus(422)
                ->assertJsonValidationErrors('min_daily_wage');
        }
    }

    // ---- who sees it ---------------------------------------------------------------------------

    public function test_homeowners_and_contractors_see_it_in_the_team_search_and_on_the_profile(): void
    {
        $worker = $this->workerWithRate(850);

        foreach (['homeowner', 'contractor'] as $role) {
            Sanctum::actingAs($this->user($role));

            $this->getJson('/api/workers')->assertOk()->assertJsonPath('0.minDailyWage', 850);
            $this->getJson("/api/workers/{$worker->id}")->assertOk()->assertJsonPath('minDailyWage', 850);
        }
    }

    public function test_the_worker_sees_their_own_rate(): void
    {
        $worker = $this->workerWithRate(850);
        Sanctum::actingAs($worker);

        $this->getJson("/api/workers/{$worker->id}")->assertOk()->assertJsonPath('minDailyWage', 850);
    }

    public function test_other_workers_and_suppliers_do_not_see_it(): void
    {
        $worker = $this->workerWithRate(850);

        foreach (['worker', 'supplier'] as $role) {
            Sanctum::actingAs($this->user($role));

            $this->getJson('/api/workers')->assertOk()->assertJsonPath('0.minDailyWage', null);
            $this->getJson("/api/workers/{$worker->id}")->assertOk()->assertJsonPath('minDailyWage', null);
        }
    }

    public function test_a_worker_who_has_not_set_one_shows_none(): void
    {
        $worker = $this->workerWithRate(null);
        Sanctum::actingAs($this->user('homeowner'));

        $this->getJson("/api/workers/{$worker->id}")->assertOk()->assertJsonPath('minDailyWage', null);
    }

    // ---- on a project's team -------------------------------------------------------------------

    public function test_the_project_team_shows_the_workers_rate_to_those_who_set_wages_only(): void
    {
        $worker = $this->workerWithRate(850);
        $otherWorker = $this->workerWithRate(700);
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House', 'budget' => 0, 'totalEstimate' => 1000000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Build', 'percentComplete' => 100]],
        ]);
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach([$worker->id, $otherWorker->id]);

        $rates = fn (array $project) => collect($project['workers'])->mapWithKeys(fn ($w) => [$w['id'] => $w['minDailyWage']])->all();

        Sanctum::actingAs($owner);
        $this->assertSame([$worker->id => 850, $otherWorker->id => 700], $rates($this->getJson("/api/dashboard?project_id={$project->id}")->json('project')));

        Sanctum::actingAs($contractor);
        $mine = collect($this->getJson('/api/my-projects')->json())->firstWhere('id', $project->id);
        $this->assertSame([$worker->id => 850, $otherWorker->id => 700], $rates($mine));

        // A worker sees their own rate and nobody else's.
        Sanctum::actingAs($worker);
        $mine = collect($this->getJson('/api/my-projects')->json())->firstWhere('id', $project->id);
        $this->assertSame([$worker->id => 850, $otherWorker->id => null], $rates($mine));
    }
}
