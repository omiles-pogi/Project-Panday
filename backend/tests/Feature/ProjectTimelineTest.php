<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectTimelineTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    /**
     * A six-month plan starting 1 Jan 2027 (the test clock is pinned there): phases of 6/10/10 weeks.
     *
     * @param  array<int, array<string, mixed>>|null  $phases
     */
    private function sixMonthProject(User $owner, ?array $phases = null): Project
    {
        Carbon::setTestNow('2027-01-01 09:00:00');

        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 6,
            'phases' => $phases ?? [
                ['name' => 'Site preparation', 'percentComplete' => 20, 'durationWeeks' => 6, 'tasks' => ['Clearing', 'Excavation']],
                ['name' => 'Structure', 'percentComplete' => 40, 'durationWeeks' => 10, 'tasks' => ['Columns', 'Beams', 'Slab', 'Walls']],
                ['name' => 'Finishing', 'percentComplete' => 40, 'durationWeeks' => 10, 'tasks' => ['Flooring', 'Painting']],
            ],
        ]);
    }

    private function completePhase(ProjectPhase $phase): void
    {
        $phase->tasks->each(fn ($task) => $task->update(['is_done' => true, 'completed_at' => now()]));
        $phase->recomputeProgress();
    }

    public function test_the_proposed_schedule_fills_the_whole_timeline_back_to_back(): void
    {
        $project = $this->sixMonthProject($this->user('homeowner'));
        $phases = $project->phases;

        $this->assertSame('2027-01-01', $phases->first()->planned_start->toDateString());
        $this->assertSame('2027-06-30', $phases->last()->planned_end->toDateString());

        foreach ($phases->slice(1) as $index => $phase) {
            $previousEnd = $phases[$index - 1]->planned_end;
            $this->assertSame($previousEnd->copy()->addDay()->toDateString(), $phase->planned_start->toDateString());
        }

        // 6/26 of 181 days: the shortest phase gets the shortest window.
        $this->assertLessThan($phases[1]->planned_start->diffInDays($phases[1]->planned_end), $phases[0]->planned_start->diffInDays($phases[0]->planned_end));
    }

    public function test_phases_without_ai_durations_are_scheduled_by_their_share_of_the_project(): void
    {
        $project = $this->sixMonthProject($this->user('homeowner'), [
            ['name' => 'Small', 'percentComplete' => 10, 'tasks' => ['A']],
            ['name' => 'Big', 'percentComplete' => 90, 'tasks' => ['B']],
        ]);

        [$small, $big] = [$project->phases[0], $project->phases[1]];
        $this->assertGreaterThan(
            $small->planned_start->diffInDays($small->planned_end) * 5,
            $big->planned_start->diffInDays($big->planned_end)
        );
        $this->assertSame('2027-06-30', $big->planned_end->toDateString());
    }

    public function test_a_project_from_before_the_calendar_existed_is_scheduled_on_first_view(): void
    {
        $owner = $this->user('homeowner');
        $project = $this->sixMonthProject($owner);
        $project->phases()->update(['planned_start' => null, 'planned_end' => null, 'duration_weeks' => null]);

        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline")
            ->assertOk()
            ->assertJsonPath('startDate', '2027-01-01')
            ->assertJsonPath('endDate', '2027-06-30');

        $this->assertNotNull($project->phases()->first()->planned_start);
    }

    public function test_the_owner_sees_a_month_by_month_calendar_with_tasks_on_their_due_month(): void
    {
        $owner = $this->user('homeowner');
        $project = $this->sixMonthProject($owner);

        Sanctum::actingAs($owner);
        $response = $this->getJson("/api/projects/{$project->id}/timeline")->assertOk();

        $response->assertJsonCount(6, 'months')
            ->assertJsonPath('months.0.label', 'January 2027')
            ->assertJsonPath('months.5.label', 'June 2027')
            ->assertJsonCount(3, 'phases')
            ->assertJsonPath('overall.tasks.total', 8);

        // Every task is due in exactly one month, so the months' tasks add back up to all of them.
        $dueTasks = collect($response->json('months'))->sum(fn ($month) => count($month['tasks']));
        $this->assertSame(8, $dueTasks);

        // January is when the first phase's work happens.
        $this->assertSame('Site preparation', $response->json('months.0.phases.0.name'));
        $this->assertSame('Clearing', $response->json('months.0.tasks.0.description'));
    }

    public function test_a_project_with_nothing_done_falls_behind_as_the_schedule_moves_on(): void
    {
        $owner = $this->user('homeowner');
        $project = $this->sixMonthProject($owner);

        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline")
            ->assertJsonPath('overall.status', 'on_track')
            ->assertJsonPath('overall.actualPct', 0);

        Carbon::setTestNow('2027-03-31 09:00:00');
        $response = $this->getJson("/api/projects/{$project->id}/timeline")->assertOk();

        $this->assertGreaterThan(40, $response->json('overall.plannedPct'));
        $response->assertJsonPath('overall.status', 'significantly_behind')
            ->assertJsonPath('phases.0.status', 'overdue')
            ->assertJsonPath('months.0.tasks.0.status', 'overdue');
        $this->assertLessThan(0, $response->json('overall.variancePct'));
    }

    public function test_finishing_work_early_puts_the_project_ahead_of_schedule(): void
    {
        $owner = $this->user('homeowner');
        $project = $this->sixMonthProject($owner);
        $this->completePhase($project->phases[0]);
        $this->completePhase($project->phases[1]);

        Carbon::setTestNow('2027-03-31 09:00:00');
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline")
            ->assertOk()
            ->assertJsonPath('overall.actualPct', 60)
            ->assertJsonPath('overall.status', 'ahead')
            ->assertJsonPath('phases.0.status', 'completed')
            ->assertJsonPath('phases.2.status', 'upcoming');
    }

    public function test_actual_progress_is_replayed_per_month_from_completion_dates(): void
    {
        $owner = $this->user('homeowner');
        $project = $this->sixMonthProject($owner);

        // Phase 1 finished on 20 Jan; nothing since.
        Carbon::setTestNow('2027-01-20 09:00:00');
        $this->completePhase($project->phases[0]);
        Carbon::setTestNow('2027-03-15 09:00:00');

        Sanctum::actingAs($owner);
        $months = $this->getJson("/api/projects/{$project->id}/timeline")->assertOk()->json('months');

        $this->assertSame(20, $months[0]['actualPct']);
        $this->assertSame(20, $months[1]['actualPct']);
        $this->assertSame(20, $months[2]['actualPct']);
        $this->assertNull($months[3]['actualPct']);
        $this->assertTrue($months[2]['isCurrent']);
    }

    public function test_a_task_completed_after_its_due_date_is_marked_late(): void
    {
        $owner = $this->user('homeowner');
        $project = $this->sixMonthProject($owner);

        Carbon::setTestNow('2027-02-20 09:00:00');
        $project->phases[0]->tasks->first()->update(['is_done' => true, 'completed_at' => now()]);

        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline")
            ->assertJsonPath('months.0.tasks.0.status', 'completed_late');
    }

    public function test_toggling_a_checklist_task_records_and_clears_its_completion_time(): void
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = $this->sixMonthProject($owner);
        $project->contractors()->attach($contractor->id);
        $phase = $project->phases[0];
        $task = $phase->tasks->first();

        Sanctum::actingAs($contractor);
        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task->id}", ['is_done' => true])->assertOk();
        $this->assertNotNull($task->fresh()->completed_at);

        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task->id}", ['is_done' => false])->assertOk();
        $this->assertNull($task->fresh()->completed_at);
    }

    public function test_an_assigned_contractor_can_view_the_calendar(): void
    {
        $contractor = $this->user('contractor');
        $project = $this->sixMonthProject($this->user('homeowner'));
        $project->contractors()->attach($contractor->id);

        Sanctum::actingAs($contractor);
        $this->getJson("/api/projects/{$project->id}/timeline")->assertOk()->assertJsonPath('projectId', $project->id);
    }

    public function test_workers_and_suppliers_cannot_view_the_calendar_even_when_on_the_project(): void
    {
        $worker = $this->user('worker');
        $project = $this->sixMonthProject($this->user('homeowner'));
        $project->workers()->attach($worker->id);

        Sanctum::actingAs($worker);
        $this->getJson("/api/projects/{$project->id}/timeline")->assertForbidden();

        Sanctum::actingAs($this->user('supplier'));
        $this->getJson("/api/projects/{$project->id}/timeline")->assertForbidden();
    }

    public function test_other_homeowners_and_unassigned_contractors_cannot_view_the_calendar(): void
    {
        $project = $this->sixMonthProject($this->user('homeowner'));

        Sanctum::actingAs($this->user('homeowner'));
        $this->getJson("/api/projects/{$project->id}/timeline")->assertStatus(422);

        Sanctum::actingAs($this->user('contractor'));
        $this->getJson("/api/projects/{$project->id}/timeline")->assertStatus(422);
    }

    public function test_the_calendar_requires_authentication(): void
    {
        $project = $this->sixMonthProject($this->user('homeowner'));

        $this->getJson("/api/projects/{$project->id}/timeline")->assertUnauthorized();
    }
}
