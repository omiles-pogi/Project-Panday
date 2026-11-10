<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectProgressTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner, array $weights): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'Progress regression', 'budget' => 1000000, 'totalEstimate' => 900000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => array_map(fn ($weight, $index) => [
                'name' => 'Phase '.($index + 1), 'percentComplete' => $weight, 'durationWeeks' => 4,
                'tasks' => ['Prepare site', 'Complete work', 'Inspect work'],
            ], $weights, array_keys($weights)),
        ]);
    }

    private function completePhase(Project $project, int $index): void
    {
        $phase = $project->phases[$index];
        foreach ($phase->tasks as $task) {
            $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task->id}", ['is_done' => true])->assertOk();
        }
    }

    public function test_zero_phase_weights_do_not_hide_completed_work_from_any_role(): void
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $project = $this->project($owner, array_fill(0, 7, 0));
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);
        Sanctum::actingAs($contractor);
        for ($index = 0; $index < 5; $index++) {
            $this->completePhase($project, $index);
        }

        $this->getJson('/api/my-projects')->assertOk()
            ->assertJsonPath('0.overallProgressPct', 71)
            ->assertJsonPath('0.canManageChecklist', true);
        Sanctum::actingAs($worker);
        $this->getJson('/api/my-projects')->assertOk()
            ->assertJsonPath('0.overallProgressPct', 71)
            ->assertJsonPath('0.canManageChecklist', false);
        Sanctum::actingAs($owner);
        $this->getJson("/api/dashboard?project_id={$project->id}")->assertOk()
            ->assertJsonPath('project.overallProgressPct', 71);
        $this->getJson("/api/projects/{$project->id}/timeline")->assertOk()
            ->assertJsonPath('overall.actualPct', 71)
            ->assertJsonPath('overall.tasks.done', 15);
        $this->getJson("/api/projects/{$project->id}/activity-log")->assertOk()
            ->assertJsonPath('0.overallProgressPct', 71);

        // Finishing the remaining work reaches 100%, even though the saved shares remain zero.
        Sanctum::actingAs($contractor);
        $this->completePhase($project, 5);
        $this->completePhase($project, 6);
        $this->getJson('/api/my-projects')->assertOk()->assertJsonPath('0.overallProgressPct', 100);
        $this->assertSame(0, $project->phases()->sum('weight_pct'));
    }

    public function test_zero_weight_calendar_history_uses_the_same_fallback_as_current_progress(): void
    {
        Carbon::setTestNow('2027-01-01 09:00:00');
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = $this->project($owner, [0, 0]);
        $project->contractors()->attach($contractor->id);
        Sanctum::actingAs($contractor);
        Carbon::setTestNow('2027-01-15 09:00:00');
        $this->completePhase($project, 0);

        Carbon::setTestNow('2027-03-10 09:00:00');
        Sanctum::actingAs($owner);
        $timeline = $this->getJson("/api/projects/{$project->id}/timeline")->assertOk()
            ->assertJsonPath('overall.actualPct', 50)->json();
        $months = collect($timeline['months'])->keyBy('key');
        $this->assertSame(50, $months['2027-01']['actualPct']);
        $this->assertSame(50, $months['2027-03']['actualPct']);
    }

    public function test_existing_nonzero_phase_shares_still_weight_the_project(): void
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = $this->project($owner, [40, 60]);
        $project->contractors()->attach($contractor->id);
        Sanctum::actingAs($contractor);
        $this->completePhase($project, 0);

        $this->getJson('/api/my-projects')->assertOk()->assertJsonPath('0.overallProgressPct', 40);
    }

    public function test_deleting_the_last_completed_task_resets_the_phase_and_overall_progress(): void
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = $this->project($owner, [0]);
        $project->contractors()->attach($contractor->id);
        Sanctum::actingAs($contractor);
        $this->completePhase($project, 0);
        $phase = $project->phases->first();
        foreach ($phase->tasks as $task) {
            $this->deleteJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task->id}")->assertNoContent();
        }

        $this->getJson('/api/my-projects')->assertOk()
            ->assertJsonPath('0.overallProgressPct', 0)
            ->assertJsonPath('0.phases.0.progressPct', 0);
    }

    public function test_an_empty_draft_has_zero_progress(): void
    {
        $project = app(ProjectService::class)->startDraft($this->user('homeowner'));
        $this->assertSame(0, $project->overallProgressPct());
    }
}
