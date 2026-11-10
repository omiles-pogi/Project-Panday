<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectDraftTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    /**
     * @return array<string, mixed>
     */
    private function plan(): array
    {
        return [
            'projectTitle' => 'Modern 3BR House',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [
                ['name' => 'Site preparation', 'percentComplete' => 40, 'durationWeeks' => 10, 'tasks' => ['Clearing', 'Excavation']],
                ['name' => 'Finishing', 'percentComplete' => 60, 'durationWeeks' => 16, 'tasks' => ['Painting']],
            ],
        ];
    }

    public function test_new_project_adds_a_not_started_placeholder_to_the_homeowners_projects(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);

        $this->postJson('/api/projects/draft')
            ->assertCreated()
            ->assertJsonPath('status', 'not_started')
            ->assertJsonPath('title', 'New Project');

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.status', 'not_started');
    }

    public function test_asking_again_resumes_the_placeholder_instead_of_piling_up_blanks(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);

        $first = $this->postJson('/api/projects/draft')->assertCreated()->assertJsonPath('created', true)->json('id');
        // Not new this time, so the app resumes its chat instead of wiping it.
        $this->postJson('/api/projects/draft')->assertOk()->assertJsonPath('id', $first)->assertJsonPath('created', false);

        $this->assertSame(1, $owner->projects()->count());
    }

    public function test_only_homeowners_can_start_a_draft(): void
    {
        Sanctum::actingAs($this->user('contractor'));
        $this->postJson('/api/projects/draft')->assertForbidden();

        Sanctum::actingAs($this->user('worker'));
        $this->postJson('/api/projects/draft')->assertForbidden();
    }

    public function test_the_dashboard_opens_on_the_newest_project_even_when_two_start_the_same_day(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $existing = $this->postJson('/api/projects', $this->plan())->assertCreated()->json('id');
        $draft = $this->postJson('/api/projects/draft')->assertCreated()->json('id');

        $this->assertGreaterThan($existing, $draft);
        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('project.id', $draft)
            ->assertJsonPath('project.status', 'not_started')
            ->assertJsonPath('stats.active', 1);
    }

    public function test_approving_a_plan_fills_in_the_placeholder_and_starts_it(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $draft = $this->postJson('/api/projects/draft')->json('id');

        $this->postJson("/api/projects/{$draft}/plan", $this->plan())
            ->assertOk()
            ->assertJsonPath('id', $draft)
            ->assertJsonPath('title', 'Modern 3BR House')
            ->assertJsonPath('status', 'active')
            ->assertJsonCount(2, 'phases');

        // No second project was created alongside it.
        $this->assertSame(1, $owner->projects()->count());
        $this->getJson('/api/dashboard')->assertJsonPath('stats.active', 1);

        // And it is scheduled on the calendar like any other approved plan.
        $this->getJson("/api/projects/{$draft}/timeline")->assertOk()->assertJsonCount(2, 'phases');
    }

    public function test_a_started_project_cannot_be_overwritten_by_another_plan(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $existing = $this->postJson('/api/projects', $this->plan())->json('id');

        $this->postJson("/api/projects/{$existing}/plan", $this->plan())->assertStatus(422);
    }

    public function test_only_the_owner_can_approve_a_plan_into_their_placeholder(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $draft = $this->postJson('/api/projects/draft')->json('id');

        Sanctum::actingAs($this->user());
        $this->postJson("/api/projects/{$draft}/plan", $this->plan())->assertStatus(422);
        $this->assertSame('not_started', $owner->projects()->first()->status);
    }

    public function test_an_invalid_plan_leaves_the_placeholder_untouched(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $draft = $this->postJson('/api/projects/draft')->json('id');

        $this->postJson("/api/projects/{$draft}/plan", ['projectTitle' => 'Half a plan'])->assertStatus(422);
        $this->assertSame('not_started', $owner->projects()->first()->status);
    }

    public function test_a_placeholder_is_not_offered_to_contractors_or_workers_to_apply_to(): void
    {
        Sanctum::actingAs($this->user());
        $this->postJson('/api/projects/draft')->assertCreated();

        Sanctum::actingAs($this->user('worker'));
        $this->getJson('/api/projects/available')->assertOk()->assertJsonCount(0);

        Sanctum::actingAs($this->user('contractor'));
        $this->getJson('/api/projects/available-for-contractors')->assertOk()->assertJsonCount(0);
    }

    public function test_a_team_cannot_be_invited_before_the_plan_is_approved(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $draft = $this->postJson('/api/projects/draft')->json('id');

        $this->postJson("/api/projects/{$draft}/contractors", ['contractor_id' => $this->user('contractor')->id])->assertStatus(422);
        $this->postJson("/api/projects/{$draft}/workers", ['worker_id' => $this->user('worker')->id])->assertStatus(422);
    }

    public function test_a_placeholder_can_be_deleted_like_any_project(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $draft = $this->postJson('/api/projects/draft')->json('id');

        $this->deleteJson("/api/projects/{$draft}")->assertNoContent();
        $this->assertSame(0, $owner->projects()->count());
    }

    public function test_the_calendar_reports_a_placeholder_as_not_started(): void
    {
        Sanctum::actingAs($this->user());
        $draft = $this->postJson('/api/projects/draft')->json('id');

        $this->getJson("/api/projects/{$draft}/timeline")
            ->assertOk()
            ->assertJsonPath('overall.status', 'not_started')
            ->assertJsonCount(0, 'phases')
            ->assertJsonCount(0, 'months');
    }
}
