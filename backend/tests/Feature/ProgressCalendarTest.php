<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProgressCalendarTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner): Project
    {
        Carbon::setTestNow('2026-11-01 09:00:00');

        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'Approved five-month build', 'budget' => 500000, 'totalEstimate' => 450000,
            'timelineValue' => 5, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Approved structural works', 'percentComplete' => 100, 'durationWeeks' => 20, 'tasks' => ['Foundation and structure', 'Final inspection']]],
        ]);
    }

    public function test_saved_calendar_uses_the_approved_november_to_march_phase_windows_including_cross_month_activities(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $before = $project->phases()->with('tasks')->get()->toArray();
        Sanctum::actingAs($owner);
        $response = $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertOk()
            ->assertJsonPath('startDate', '2026-11-01')->assertJsonPath('endDate', '2027-03-31');
        $months = $response->json('months');
        $this->assertSame(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'], array_column($months, 'key'));
        // The first activity ends in January, but its scheduled November work must still appear.
        $this->assertSame([], $months[0]['tasks']);
        $this->assertSame('Foundation and structure', $months[0]['activities'][0]['description']);
        $this->assertSame($months[0]['activities'][0]['id'], $months[1]['activities'][0]['id']);
        foreach ($months as $month) {
            foreach ($month['activities'] as $activity) {
                $this->assertLessThanOrEqual($month['key'].'-31', $activity['plannedStart']);
                $this->assertGreaterThanOrEqual($month['key'].'-01', $activity['plannedEnd']);
            }
        }
        $this->assertSame($before, $project->phases()->with('tasks')->get()->toArray());
        $this->assertSame(0, $project->fresh()->overallProgressPct());
    }

    public function test_missing_saved_dates_are_reported_without_backfilling_or_rescheduling_for_either_authorized_role(): void
    {
        $owner = $this->user();
        $contractor = $this->user('contractor');
        $project = $this->project($owner);
        $project->contractors()->attach($contractor);
        $project->phases()->first()->update(['planned_end' => null]);
        $before = $project->phases()->get()->map->getRawOriginal()->all();
        foreach ([$owner, $contractor] as $viewer) {
            Sanctum::actingAs($viewer);
            $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertUnprocessable()
                ->assertJsonPath('error', 'The saved construction schedule is unavailable or incomplete. Existing phase dates have not been changed.');
        }
        $this->assertSame($before, $project->phases()->get()->map->getRawOriginal()->all());
        $project->update(['status' => 'not_started']);
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertUnprocessable();
        $this->getJson("/api/projects/{$project->id}/timeline?saved_only=unexpected")->assertUnprocessable();
    }

    public function test_actual_updates_refresh_calendar_phase_overall_and_activity_log_without_dates_completing_tasks(): void
    {
        $owner = $this->user();
        $contractor = $this->user('contractor');
        $project = $this->project($owner);
        $project->contractors()->attach($contractor);
        $phase = $project->phases->first();
        $task = $phase->tasks->first();
        $dates = [$phase->planned_start->toDateString(), $phase->planned_end->toDateString()];
        Carbon::setTestNow('2027-04-02 09:00:00');
        Sanctum::actingAs($contractor);
        $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertOk()
            ->assertJsonPath('overall.actualPct', 0)->assertJsonPath('overall.tasks.overdue', 2);
        $this->assertFalse($task->fresh()->is_done);
        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task->id}", ['is_done' => true])->assertOk();
        $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertOk()
            ->assertJsonPath('overall.actualPct', 50)->assertJsonPath('phases.0.progressPct', 50)
            ->assertJsonPath('months.0.activities.0.isDone', true)->assertJsonPath('months.0.activities.0.status', 'completed_late')
            ->assertJsonPath('months.0.activities.0.completedAt', '2027-04-02');
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/activity-log")->assertOk()
            ->assertJsonPath('0.date', '2027-04-02')->assertJsonPath('0.overallProgressPct', 50);
        $this->assertSame($dates, [$phase->fresh()->planned_start->toDateString(), $phase->fresh()->planned_end->toDateString()]);
        // Existing policy: an owner cannot edit the assigned contractor's checklist.
        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task->id}", ['is_done' => false])->assertUnprocessable();
    }

    public function test_project_access_and_legacy_completion_dates_are_not_inferred_or_leaked(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $other = $this->project($this->user());
        $url = "/api/projects/{$project->id}/timeline?saved_only=1";
        $this->getJson($url)->assertUnauthorized();
        foreach (['worker', 'supplier'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson($url)->assertForbidden();
        }
        foreach ([$this->user(), $this->user('contractor')] as $stranger) {
            Sanctum::actingAs($stranger);
            $this->getJson($url)->assertUnprocessable();
        }
        $project->phases->first()->tasks->first()->update(['is_done' => true, 'completed_at' => null]);
        Sanctum::actingAs($owner);
        $this->getJson($url)->assertOk()->assertJsonPath('months.0.activities.0.isDone', true)
            ->assertJsonPath('months.0.activities.0.completedAt', null);
        $this->getJson("/api/projects/{$other->id}/timeline?saved_only=1")->assertUnprocessable();
    }

    public function test_reading_updated_saved_dates_reflects_them_without_extending_or_repairing_the_project(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        // Simulate an existing authorized scheduling change; the calendar endpoint is only a reader.
        $project->phases()->first()->update(['planned_start' => '2026-12-01', 'planned_end' => '2027-02-28']);
        $before = $project->phases()->with('tasks')->get()->toArray();
        $duration = [$project->timeline_value, $project->timeline_unit];
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertOk()
            ->assertJsonPath('startDate', '2026-12-01')->assertJsonPath('endDate', '2027-02-28')
            ->assertJsonPath('months.0.key', '2026-12');
        $this->assertSame($before, $project->phases()->with('tasks')->get()->toArray());
        $this->assertSame($duration, [$project->fresh()->timeline_value, $project->fresh()->timeline_unit]);
    }

    public function test_potential_team_conflicts_are_checked_without_disclosing_another_projects_private_schedule(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $worker = $this->user('worker');
        $project->workers()->attach($worker);
        $private = $this->project($this->user());
        $private->update(['title' => 'Private unrelated residence']);
        $private->workers()->attach($worker);
        $completed = $this->project($this->user());
        $completed->workers()->attach($worker);
        $completed->update(['status' => 'completed', 'completion_confirmed_at' => now()]);
        Sanctum::actingAs($owner);
        $response = $this->getJson("/api/projects/{$project->id}/timeline?saved_only=1")->assertOk()
            ->assertJsonCount(1, 'assignmentWarnings')->assertJsonPath('assignmentWarnings.0.memberId', $worker->id)
            ->assertJsonPath('assignmentWarnings.0.overlappingAssignments', 1);
        $this->assertSame(['memberId', 'name', 'role', 'overlappingAssignments'], array_keys($response->json('assignmentWarnings.0')));
        $this->assertStringNotContainsString('Private unrelated residence', $response->getContent());
        $this->assertSame(1, $project->workers()->count());
        $this->assertSame(1, $private->workers()->count());
    }
}
