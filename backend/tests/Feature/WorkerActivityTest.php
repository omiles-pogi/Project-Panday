<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkerActivityTest extends TestCase
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

    /** 10:00 on the given Philippine day (02:00 UTC). */
    private function morning(string $day): void
    {
        Carbon::setTestNow("{$day} 02:00:00");
    }

    /** @return array{0: Project, 1: User, 2: User, 3: User} project, owner, contractor, worker — the worker on ₱850/day for 30 days */
    private function site(array $wage = ['wage_amount' => 850, 'wage_unit' => 'per_day', 'wage_days' => 30]): array
    {
        $this->morning('2027-03-01');
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House', 'location' => 'Quezon City', 'budget' => 2500000, 'totalEstimate' => 2420000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'durationWeeks' => 26, 'tasks' => ['Pour slab']]],
        ]);
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id, $wage);

        return [$project, $owner, $contractor, $worker];
    }

    private function workDay(Project $project, User $worker, string $day, bool $checkOut = true): void
    {
        Sanctum::actingAs($worker);
        $this->morning($day);
        $this->postJson("/api/projects/{$project->id}/attendance/check-in")->assertCreated();
        if ($checkOut) {
            Carbon::setTestNow("{$day} 10:00:00");
            $this->postJson("/api/projects/{$project->id}/attendance/check-out")->assertOk();
        }
    }

    // ---- attendance ----------------------------------------------------------------------------

    public function test_a_worker_checks_in_and_out_and_the_hours_are_counted(): void
    {
        [$project, , , $worker] = $this->site();
        Sanctum::actingAs($worker);

        $this->morning('2027-03-10');
        $this->getJson('/api/worker/attendance')->assertOk()
            ->assertJsonPath('date', '2027-03-10')
            ->assertJsonPath('today.0.projectId', $project->id)
            ->assertJsonPath('today.0.status', 'not_in');

        $this->postJson("/api/projects/{$project->id}/attendance/check-in")
            ->assertCreated()->assertJsonPath('status', 'on_site')->assertJsonPath('date', '2027-03-10');

        Carbon::setTestNow('2027-03-10 10:30:00');
        $this->postJson("/api/projects/{$project->id}/attendance/check-out")
            ->assertOk()->assertJsonPath('status', 'done')->assertJsonPath('hours', 8.5);

        $this->getJson('/api/worker/attendance')->assertOk()
            ->assertJsonPath('today.0.status', 'done')
            ->assertJsonPath('history.0.date', '2027-03-10')
            ->assertJsonPath('history.0.projectTitle', 'My House');
    }

    public function test_checking_in_twice_or_out_without_checking_in_is_refused(): void
    {
        [$project, , , $worker] = $this->site();
        Sanctum::actingAs($worker);
        $this->morning('2027-03-10');

        $this->postJson("/api/projects/{$project->id}/attendance/check-out")
            ->assertStatus(422)->assertJsonPath('error', 'Check in on this project before checking out.');

        $this->postJson("/api/projects/{$project->id}/attendance/check-in")->assertCreated();
        $this->postJson("/api/projects/{$project->id}/attendance/check-in")
            ->assertStatus(422)->assertJsonPath('error', 'You already checked in on this project today.');

        $this->postJson("/api/projects/{$project->id}/attendance/check-out")->assertOk();
        $this->postJson("/api/projects/{$project->id}/attendance/check-out")
            ->assertStatus(422)->assertJsonPath('error', 'You already checked out of this project today.');
    }

    public function test_the_day_is_the_philippine_day_not_the_servers(): void
    {
        [$project, , , $worker] = $this->site();
        Sanctum::actingAs($worker);

        // 22:00 UTC on the 10th is 06:00 on the 11th in Manila.
        Carbon::setTestNow('2027-03-10 22:00:00');
        $this->postJson("/api/projects/{$project->id}/attendance/check-in")->assertCreated()->assertJsonPath('date', '2027-03-11');
    }

    public function test_only_an_assigned_worker_can_check_in_and_only_on_an_active_project(): void
    {
        [$project, , , $worker] = $this->site();
        $outsider = $this->user('worker');

        Sanctum::actingAs($outsider);
        $this->postJson("/api/projects/{$project->id}/attendance/check-in")
            ->assertStatus(422)->assertJsonPath('error', 'You are not assigned to this project.');
        $this->getJson('/api/worker/attendance')->assertOk()->assertJsonPath('today', [])->assertJsonPath('history', []);

        $project->update(['status' => 'completed']);
        Sanctum::actingAs($worker);
        $this->postJson("/api/projects/{$project->id}/attendance/check-in")
            ->assertStatus(422)->assertJsonPath('error', 'This project is not active.');
    }

    public function test_a_worker_only_sees_their_own_attendance(): void
    {
        [$project, , , $worker] = $this->site();
        $mate = $this->user('worker');
        $project->workers()->attach($mate->id);

        $this->workDay($project, $mate, '2027-03-10');

        Sanctum::actingAs($worker);
        $this->getJson('/api/worker/attendance')->assertOk()->assertJsonCount(0, 'history');
    }

    public function test_these_screens_belong_to_workers(): void
    {
        [$project, $owner, $contractor] = $this->site();

        foreach ([$owner, $contractor] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/worker/attendance')->assertForbidden();
            $this->getJson('/api/worker/work-logs')->assertForbidden();
            $this->getJson('/api/worker/earnings')->assertForbidden();
            $this->postJson("/api/projects/{$project->id}/attendance/check-in")->assertForbidden();
            $this->putJson("/api/projects/{$project->id}/work-log", ['summary' => 'Poured the slab'])->assertForbidden();
        }
    }

    // ---- daily work log ------------------------------------------------------------------------

    public function test_a_worker_writes_and_then_corrects_todays_log(): void
    {
        [$project, , , $worker] = $this->site();
        Sanctum::actingAs($worker);
        $this->morning('2027-03-10');

        $this->getJson('/api/worker/work-logs')->assertOk()
            ->assertJsonPath('projects.0.todayLog', null)->assertJsonCount(0, 'logs');

        $this->putJson("/api/projects/{$project->id}/work-log", ['summary' => '  Tied rebar for the columns  '])
            ->assertOk()->assertJsonPath('summary', 'Tied rebar for the columns')->assertJsonPath('date', '2027-03-10');
        $this->putJson("/api/projects/{$project->id}/work-log", ['summary' => 'Tied rebar and poured two columns'])->assertOk();

        $this->getJson('/api/worker/work-logs')->assertOk()
            ->assertJsonPath('projects.0.todayLog', 'Tied rebar and poured two columns')
            ->assertJsonCount(1, 'logs');
    }

    public function test_a_log_can_be_written_for_the_past_week_but_not_the_future_or_longer_ago(): void
    {
        [$project, , , $worker] = $this->site();
        Sanctum::actingAs($worker);
        $this->morning('2027-03-10');
        $url = "/api/projects/{$project->id}/work-log";

        $this->putJson($url, ['summary' => 'Cleared the lot', 'log_date' => '2027-03-03'])->assertOk()->assertJsonPath('date', '2027-03-03');
        $this->putJson($url, ['summary' => 'Too long ago', 'log_date' => '2027-03-02'])
            ->assertStatus(422)->assertJsonPath('error', 'A daily log can be written for today or the past 7 days.');
        $this->putJson($url, ['summary' => 'Tomorrow', 'log_date' => '2027-03-11'])->assertStatus(422);
        $this->putJson($url, ['summary' => 'x'])->assertStatus(422)->assertJsonValidationErrors('summary');
        $this->putJson($url, ['summary' => 'Cleared the lot', 'log_date' => 'last tuesday'])->assertStatus(422)->assertJsonValidationErrors('log_date');
    }

    public function test_only_an_assigned_worker_can_log_work(): void
    {
        [$project] = $this->site();
        Sanctum::actingAs($this->user('worker'));

        $this->putJson("/api/projects/{$project->id}/work-log", ['summary' => 'Poured the slab'])
            ->assertStatus(422)->assertJsonPath('error', 'You are not assigned to this project.');
    }

    // ---- earnings ------------------------------------------------------------------------------

    public function test_a_day_rate_worker_earns_the_rate_for_every_day_they_checked_in(): void
    {
        [$project, , , $worker] = $this->site();
        $this->workDay($project, $worker, '2027-03-10');
        $this->workDay($project, $worker, '2027-03-11');
        $this->workDay($project, $worker, '2027-03-12', checkOut: false);

        Sanctum::actingAs($worker);
        $this->getJson('/api/worker/earnings')->assertOk()
            ->assertJsonPath('projects.0.projectTitle', 'My House')
            ->assertJsonPath('projects.0.wage.amount', 850)
            ->assertJsonPath('projects.0.daysWorked', 3)
            ->assertJsonPath('projects.0.hoursWorked', 16)
            ->assertJsonPath('projects.0.earned', 2550)
            ->assertJsonPath('totals.daysWorked', 3)
            ->assertJsonPath('totals.earned', 2550);
    }

    public function test_a_fixed_fee_or_unpaid_worker_has_days_but_no_per_day_earnings(): void
    {
        [$project, , , $worker] = $this->site(['wage_amount' => 350000, 'wage_unit' => 'fixed', 'wage_days' => null]);
        $this->workDay($project, $worker, '2027-03-10');

        Sanctum::actingAs($worker);
        $this->getJson('/api/worker/earnings')->assertOk()
            ->assertJsonPath('projects.0.wage.unit', 'fixed')
            ->assertJsonPath('projects.0.daysWorked', 1)
            ->assertJsonPath('projects.0.earned', null)
            ->assertJsonPath('totals.earned', 0);

        // No wage is a missing amount (the unit column always has a value).
        $project->workers()->updateExistingPivot($worker->id, ['wage_amount' => null]);
        $this->getJson('/api/worker/earnings')->assertOk()
            ->assertJsonPath('projects.0.wage', null)->assertJsonPath('projects.0.earned', null);
    }

    // ---- the team's view -----------------------------------------------------------------------

    public function test_the_homeowner_and_contractor_see_the_teams_attendance_logs_and_earnings(): void
    {
        [$project, $owner, $contractor, $worker] = $this->site();
        $idle = $this->user('worker');
        $project->workers()->attach($idle->id);

        $this->workDay($project, $worker, '2027-03-09');
        $this->workDay($project, $worker, '2027-03-10', checkOut: false);
        Sanctum::actingAs($worker);
        $this->putJson("/api/projects/{$project->id}/work-log", ['summary' => 'Tied rebar'])->assertOk();

        foreach ([$owner, $contractor] as $viewer) {
            Sanctum::actingAs($viewer);
            $response = $this->getJson("/api/projects/{$project->id}/team-activity")->assertOk()
                ->assertJsonPath('title', 'My House')
                ->assertJsonCount(2, 'workers');

            $working = collect($response->json('workers'))->firstWhere('id', $worker->id);
            $this->assertSame('on_site', $working['today']['status']);
            $this->assertSame(2, $working['daysWorked']);
            $this->assertSame(1700, $working['earned']);
            $this->assertSame('Tied rebar', $working['recentLogs'][0]['summary']);

            $resting = collect($response->json('workers'))->firstWhere('id', $idle->id);
            $this->assertSame('not_in', $resting['today']['status']);
            $this->assertSame(0, $resting['daysWorked']);
        }
    }

    public function test_the_team_view_is_only_for_the_people_running_the_project(): void
    {
        [$project, , , $worker] = $this->site();

        foreach ([$this->user('homeowner'), $this->user('contractor')] as $stranger) {
            Sanctum::actingAs($stranger);
            $this->getJson("/api/projects/{$project->id}/team-activity")
                ->assertStatus(422)->assertJsonPath('error', 'You cannot view this project\'s team activity.');
        }

        Sanctum::actingAs($worker);
        $this->getJson("/api/projects/{$project->id}/team-activity")->assertForbidden();
    }
}
