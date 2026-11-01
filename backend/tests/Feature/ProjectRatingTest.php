<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectRatingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $contractor;

    private User $worker;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        $this->contractor = User::factory()->create(['role' => 'contractor', 'approval_status' => 'approved']);
        $this->worker = User::factory()->create(['role' => 'worker', 'approval_status' => 'approved']);

        $this->project = app(ProjectService::class)->createFromPlan($this->owner, [
            'projectTitle' => 'My House Construction',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 7,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 50, 'tasks' => ['Excavation']],
                ['name' => 'Finishing', 'percentComplete' => 50, 'tasks' => ['Painting']],
            ],
        ]);
        $this->project->contractors()->attach($this->contractor->id);
        $this->project->workers()->attach($this->worker->id);
    }

    private function completeProject(): void
    {
        foreach ($this->project->phases as $phase) {
            $phase->update(['progress_pct' => 100]);
        }
    }

    public function test_rating_is_locked_until_the_project_is_complete(): void
    {
        Sanctum::actingAs($this->owner);

        $this->getJson("/api/projects/{$this->project->id}/ratings")
            ->assertOk()
            ->assertJsonPath('canRate', false)
            ->assertJsonPath('pendingCount', 2);

        $this->postJson("/api/projects/{$this->project->id}/ratings", ['user_id' => $this->worker->id, 'score' => 5])
            ->assertStatus(422);
        $this->assertDatabaseCount('worker_ratings', 0);
    }

    public function test_homeowner_rates_the_whole_team_once_the_project_is_complete(): void
    {
        $this->completeProject();
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/projects/{$this->project->id}/ratings", [
            'user_id' => $this->worker->id, 'score' => 4, 'comment' => 'Neat work',
        ])->assertCreated()->assertJsonPath('canRate', true)->assertJsonPath('pendingCount', 1);

        $this->postJson("/api/projects/{$this->project->id}/ratings", ['user_id' => $this->contractor->id, 'score' => 5])
            ->assertCreated()->assertJsonPath('pendingCount', 0);

        $this->assertDatabaseHas('worker_ratings', [
            'worker_id' => $this->worker->id, 'rater_id' => $this->owner->id, 'project_id' => $this->project->id, 'score' => 4,
        ]);
        $this->assertDatabaseHas('contractor_ratings', [
            'contractor_id' => $this->contractor->id, 'rater_id' => $this->owner->id, 'project_id' => $this->project->id, 'score' => 5,
        ]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $this->worker->id, 'type' => 'rating_received']);
    }

    public function test_each_team_member_can_only_be_rated_once_per_project(): void
    {
        $this->completeProject();
        Sanctum::actingAs($this->owner);
        $payload = ['user_id' => $this->worker->id, 'score' => 3];

        $this->postJson("/api/projects/{$this->project->id}/ratings", $payload)->assertCreated();
        $this->postJson("/api/projects/{$this->project->id}/ratings", $payload)->assertStatus(422);

        $this->assertDatabaseCount('worker_ratings', 1);
    }

    public function test_only_people_on_the_team_can_be_rated(): void
    {
        $this->completeProject();
        $outsider = User::factory()->create(['role' => 'worker', 'approval_status' => 'approved']);
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/projects/{$this->project->id}/ratings", ['user_id' => $outsider->id, 'score' => 5])
            ->assertStatus(422);
    }

    public function test_only_the_project_owner_can_rate_or_view(): void
    {
        $this->completeProject();
        $otherHomeowner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        Sanctum::actingAs($otherHomeowner);

        $this->getJson("/api/projects/{$this->project->id}/ratings")->assertStatus(422);
        $this->postJson("/api/projects/{$this->project->id}/ratings", ['user_id' => $this->worker->id, 'score' => 5])
            ->assertStatus(422);
    }

    public function test_score_must_be_between_one_and_five(): void
    {
        $this->completeProject();
        Sanctum::actingAs($this->owner);

        $this->postJson("/api/projects/{$this->project->id}/ratings", ['user_id' => $this->worker->id, 'score' => 6])
            ->assertStatus(422);
    }
}
