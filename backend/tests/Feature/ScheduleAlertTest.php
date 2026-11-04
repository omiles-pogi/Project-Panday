<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use App\Services\ScheduleAlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScheduleAlertTest extends TestCase
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

    /** A six-month plan starting 1 Jan 2027 (the test clock is pinned there): phases of 6/10/10 weeks. */
    private function project(User $owner): Project
    {
        Carbon::setTestNow('2027-01-01 09:00:00');

        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 6,
            'phases' => [
                ['name' => 'Site preparation', 'percentComplete' => 20, 'durationWeeks' => 6, 'tasks' => ['Clearing', 'Excavation']],
                ['name' => 'Structure', 'percentComplete' => 40, 'durationWeeks' => 10, 'tasks' => ['Columns', 'Beams', 'Slab', 'Walls']],
                ['name' => 'Finishing', 'percentComplete' => 40, 'durationWeeks' => 10, 'tasks' => ['Flooring', 'Painting']],
            ],
        ]);
    }

    /** Homeowner, one assigned contractor and one assigned worker on a fresh project. */
    private function team(): array
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $project = $this->project($owner);
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);

        return [$project, $owner, $contractor, $worker];
    }

    private function setDone(Project $project, bool $done): void
    {
        $phase = $project->phases()->first();
        $phase->tasks->each(fn ($task) => $task->update(['is_done' => $done, 'completed_at' => $done ? now() : null]));
        $phase->recomputeProgress();
    }

    private function alertsFor(User $user)
    {
        return AppNotification::where('user_id', $user->id)->where('type', 'schedule_delay')->get();
    }

    private function check(Project $project): int
    {
        return app(ScheduleAlertService::class)->check($project->fresh());
    }

    public function test_a_project_on_schedule_alerts_nobody(): void
    {
        [$project, $owner, $contractor] = $this->team();

        $this->assertSame(0, $this->check($project));
        $this->assertCount(0, $this->alertsFor($owner));
        $this->assertCount(0, $this->alertsFor($contractor));
    }

    public function test_falling_behind_alerts_the_homeowner_and_contractors_but_not_workers_and_only_once(): void
    {
        [$project, $owner, $contractor, $worker] = $this->team();

        Carbon::setTestNow('2027-03-31 09:00:00');
        $this->assertSame(2, $this->check($project));

        $alert = $this->alertsFor($owner)->sole();
        $this->assertSame('Project significantly behind schedule', $alert->title);
        $this->assertStringContainsString('My House is', $alert->body);
        $this->assertStringContainsString('behind the AI schedule', $alert->body);
        $this->assertSame($project->id, $alert->data['projectId']);
        $this->assertSame('significantly_behind', $alert->data['scheduleStatus']);
        $this->assertCount(1, $this->alertsFor($contractor));
        $this->assertCount(0, $this->alertsFor($worker));

        // Still just as late tomorrow: nobody is nagged again.
        Carbon::setTestNow('2027-04-01 09:00:00');
        $this->assertSame(0, $this->check($project));
        $this->assertCount(1, $this->alertsFor($owner));
    }

    public function test_slipping_further_alerts_again_but_a_steady_delay_does_not(): void
    {
        [$project, $owner] = $this->team();

        Carbon::setTestNow('2027-01-21 09:00:00');
        $this->check($project);
        $first = $this->alertsFor($owner)->sole();
        $this->assertSame('Project falling behind schedule', $first->title);
        $this->assertSame('slightly_behind', $first->data['scheduleStatus']);

        Carbon::setTestNow('2027-01-23 09:00:00');
        $this->assertSame(0, $this->check($project));

        Carbon::setTestNow('2027-03-31 09:00:00');
        $this->check($project);
        $this->assertSame(['slightly_behind', 'significantly_behind'], $this->alertsFor($owner)->pluck('data.scheduleStatus')->all());
    }

    public function test_getting_back_on_track_re_arms_the_alert_for_a_later_slip(): void
    {
        [$project, $owner] = $this->team();

        Carbon::setTestNow('2027-01-21 09:00:00');
        $this->check($project);
        $this->assertCount(1, $this->alertsFor($owner));

        $this->setDone($project, true);
        $this->assertSame(0, $this->check($project));
        $this->assertSame(0, $project->fresh()->delay_alert_level);

        $this->setDone($project, false);
        $this->check($project);
        $this->assertCount(2, $this->alertsFor($owner));
    }

    public function test_only_active_projects_are_checked(): void
    {
        [$project, $owner] = $this->team();
        $project->update(['status' => 'completed']);

        Carbon::setTestNow('2027-03-31 09:00:00');
        $this->assertSame(0, $this->check($project));
        $this->assertCount(0, $this->alertsFor($owner));
    }

    public function test_opening_the_calendar_raises_the_alert_for_the_whole_team_once(): void
    {
        [$project, $owner, $contractor] = $this->team();

        Carbon::setTestNow('2027-03-31 09:00:00');
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/timeline")->assertOk()->assertJsonPath('overall.status', 'significantly_behind');
        $this->getJson("/api/projects/{$project->id}/timeline")->assertOk();

        $this->assertCount(1, $this->alertsFor($owner));
        $this->assertCount(1, $this->alertsFor($contractor));
    }

    public function test_the_scheduled_command_sends_the_alerts(): void
    {
        [$project, $owner, $contractor] = $this->team();

        Carbon::setTestNow('2027-03-31 09:00:00');
        $this->artisan('projects:check-delays')->expectsOutputToContain('2 notifications sent across 1 active project')->assertSuccessful();
        $this->artisan('projects:check-delays')->expectsOutputToContain('0 notifications sent')->assertSuccessful();

        $this->assertCount(1, $this->alertsFor($owner));
        $this->assertCount(1, $this->alertsFor($contractor));
    }
}
