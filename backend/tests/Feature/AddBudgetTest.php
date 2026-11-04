<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** A homeowner whose project has outgrown its budget can add to it. */
class AddBudgetTest extends TestCase
{
    use RefreshDatabase;

    private User $homeowner;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->homeowner = $this->user('homeowner');
        $this->project = app(ProjectService::class)->createFromPlan($this->homeowner, [
            'projectTitle' => 'Santos Residence',
            'location' => 'Davao',
            'budget' => 2000000,
            'totalEstimate' => 2400000,
            'timelineMonths' => 6,
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100]],
        ]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    public function test_adding_budget_raises_it_and_closes_the_shortfall(): void
    {
        Sanctum::actingAs($this->homeowner);

        // 2,000,000 against a 2,400,000 estimate: ₱400,000 short.
        $this->postJson("/api/projects/{$this->project->id}/budget", ['amount' => 500000])
            ->assertStatus(200)
            ->assertJsonPath('id', $this->project->id)
            ->assertJsonPath('budget', 2500000)
            ->assertJsonPath('totalEstimate', 2400000);

        $this->assertSame(2500000, $this->project->fresh()->budget);
        // The copy saved with the approved plan moves too, so nothing reads the old figure.
        $this->assertSame(2500000, $this->project->fresh()->approved_plan['budget']);

        $this->getJson("/api/dashboard?project_id={$this->project->id}")->assertJsonPath('project.budget', 2500000);
    }

    public function test_each_addition_stacks_on_the_last(): void
    {
        Sanctum::actingAs($this->homeowner);

        $this->postJson("/api/projects/{$this->project->id}/budget", ['amount' => 100000])->assertStatus(200);
        $this->postJson("/api/projects/{$this->project->id}/budget", ['amount' => 250000])
            ->assertStatus(200)
            ->assertJsonPath('budget', 2350000);
    }

    public function test_the_amount_must_be_a_positive_whole_number(): void
    {
        Sanctum::actingAs($this->homeowner);

        foreach ([0, -5000, 'lots', 1500.5, null] as $bad) {
            $this->postJson("/api/projects/{$this->project->id}/budget", ['amount' => $bad])->assertStatus(422);
        }
        $this->postJson("/api/projects/{$this->project->id}/budget")->assertStatus(422);

        $this->assertSame(2000000, $this->project->fresh()->budget);
    }

    public function test_only_the_owner_can_add_budget(): void
    {
        Sanctum::actingAs($this->user('homeowner'));
        $this->postJson("/api/projects/{$this->project->id}/budget", ['amount' => 1000])->assertStatus(422);

        $contractor = $this->user('contractor');
        $this->project->contractors()->attach($contractor->id);
        Sanctum::actingAs($contractor);
        $this->postJson("/api/projects/{$this->project->id}/budget", ['amount' => 1000])->assertStatus(403);

        $this->assertSame(2000000, $this->project->fresh()->budget);
    }

    public function test_a_project_still_being_planned_has_no_budget_to_add_to(): void
    {
        $draft = app(ProjectService::class)->startDraft($this->homeowner);
        $this->assertSame('not_started', $draft->status);

        Sanctum::actingAs($this->homeowner);
        $this->postJson("/api/projects/{$draft->id}/budget", ['amount' => 1000])->assertStatus(422);
        $this->assertSame(0, $draft->fresh()->budget);
    }
}
