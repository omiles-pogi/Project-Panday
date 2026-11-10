<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WageAutoFillTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        config(['wages.default_daily_rate' => 850, 'wages.working_days_per_month' => 26, 'wages.contractor_fee_pct' => 10]);
        $this->owner = $this->user('homeowner');
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function workerWithRate(?int $rate): User
    {
        $worker = $this->user('worker');
        $worker->workerProfile()->create(['trade' => 'Mason', 'years_experience' => 5, 'min_daily_wage' => $rate]);

        return $worker;
    }

    /** A 6-month, ₱2,000,000 project; pass a fee line to give the approved plan one. */
    private function project(?int $contractorFeeLine = null): Project
    {
        $plan = [
            'projectTitle' => 'My House', 'budget' => 0, 'totalEstimate' => 2000000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Build', 'percentComplete' => 100]],
        ];
        if ($contractorFeeLine !== null) {
            $plan['budgetBreakdown'] = [
                ['category' => 'Labor Costs', 'amount' => 700000],
                ['category' => 'Contractor and Project Management Fee', 'amount' => $contractorFeeLine],
            ];
        }

        return app(ProjectService::class)->createFromPlan($this->owner, $plan);
    }

    private function invite(Project $project, string $kind, User $member): void
    {
        Sanctum::actingAs($this->owner);
        $path = $kind === 'worker' ? 'workers' : 'contractors';
        $requestPath = $kind === 'worker' ? 'worker-requests' : 'contractor-requests';
        $id = $this->postJson("/api/projects/{$project->id}/{$path}", [$kind.'_id' => $member->id])->assertCreated()->json('id');

        Sanctum::actingAs($member);
        $this->patchJson("/api/{$requestPath}/{$id}/respond", ['decision' => 'accept'])->assertOk();
    }

    private function wageOf(Project $project, string $kind, User $member): ?array
    {
        $relation = $kind === 'worker' ? $project->workers() : $project->contractors();
        $pivot = $relation->whereKey($member->id)->first()->pivot;

        return $pivot->wage_amount === null ? null : [
            'amount' => (int) $pivot->wage_amount, 'unit' => $pivot->wage_unit, 'days' => $pivot->wage_days, 'auto' => (bool) $pivot->wage_auto,
        ];
    }

    // ---- workers -------------------------------------------------------------------------------

    public function test_a_worker_joins_at_their_own_minimum_daily_wage_for_the_projects_working_days(): void
    {
        $project = $this->project();
        $worker = $this->workerWithRate(900);

        $this->invite($project, 'worker', $worker);

        // 6 months × 26 working days.
        $this->assertSame(['amount' => 900, 'unit' => 'per_day', 'days' => 156, 'auto' => true], $this->wageOf($project, 'worker', $worker));
    }

    public function test_working_days_convert_correctly_for_a_timeline_in_days_or_weeks(): void
    {
        $daysProject = app(ProjectService::class)->createFromPlan($this->owner, [
            'projectTitle' => 'Quick Repair', 'budget' => 0, 'totalEstimate' => 50000, 'timelineValue' => 14, 'timelineUnit' => 'days',
            'phases' => [['name' => 'Fix', 'percentComplete' => 100]],
        ]);
        $weeksProject = app(ProjectService::class)->createFromPlan($this->owner, [
            'projectTitle' => 'Renovation', 'budget' => 0, 'totalEstimate' => 50000, 'timelineValue' => 2, 'timelineUnit' => 'weeks',
            'phases' => [['name' => 'Renovate', 'percentComplete' => 100]],
        ]);

        $daysWorker = $this->workerWithRate(900);
        $weeksWorker = $this->workerWithRate(900);
        $this->invite($daysProject, 'worker', $daysWorker);
        $this->invite($weeksProject, 'worker', $weeksWorker);

        // 14 days and 2 weeks are the same span, so they land on the same working-day count.
        $this->assertSame(12, $this->wageOf($daysProject, 'worker', $daysWorker)['days']);
        $this->assertSame(12, $this->wageOf($weeksProject, 'worker', $weeksWorker)['days']);
    }

    public function test_a_worker_with_no_minimum_gets_the_default_day_rate(): void
    {
        $project = $this->project();
        $worker = $this->workerWithRate(null);

        $this->invite($project, 'worker', $worker);

        $this->assertSame(850, $this->wageOf($project, 'worker', $worker)['amount']);
    }

    public function test_a_workers_automatic_wage_follows_their_new_minimum_but_a_manual_one_does_not(): void
    {
        $project = $this->project();
        $auto = $this->workerWithRate(800);
        $manual = $this->workerWithRate(800);
        $this->invite($project, 'worker', $auto);
        $this->invite($project, 'worker', $manual);

        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/projects/{$project->id}/workers/{$manual->id}/wage", ['amount' => 1200, 'unit' => 'per_day', 'days' => 40])->assertOk();

        foreach ([$auto, $manual] as $worker) {
            Sanctum::actingAs($worker);
            $this->putJson('/api/worker-profile', ['trade' => 'Mason', 'years_experience' => 5, 'skills' => ['Tiling'], 'min_daily_wage' => 1000])->assertOk();
        }

        $this->assertSame(['amount' => 1000, 'unit' => 'per_day', 'days' => 156, 'auto' => true], $this->wageOf($project, 'worker', $auto));
        $this->assertSame(['amount' => 1200, 'unit' => 'per_day', 'days' => 40, 'auto' => false], $this->wageOf($project, 'worker', $manual));
    }

    public function test_a_wage_the_homeowner_cleared_is_not_brought_back_by_a_rate_change(): void
    {
        $project = $this->project();
        $worker = $this->workerWithRate(800);
        $this->invite($project, 'worker', $worker);

        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/projects/{$project->id}/workers/{$worker->id}/wage", ['amount' => null])->assertOk();

        Sanctum::actingAs($worker);
        $this->putJson('/api/worker-profile', ['trade' => 'Mason', 'years_experience' => 5, 'skills' => ['Tiling'], 'min_daily_wage' => 1000])->assertOk();

        $this->assertNull($this->wageOf($project, 'worker', $worker));
    }

    // ---- contractors ---------------------------------------------------------------------------

    public function test_an_invited_contractor_gets_the_plans_contractor_fee_line(): void
    {
        $project = $this->project(contractorFeeLine: 300000);
        $contractor = $this->user('contractor');

        $this->invite($project, 'contractor', $contractor);

        $this->assertSame(['amount' => 300000, 'unit' => 'fixed', 'days' => null, 'auto' => true], $this->wageOf($project, 'contractor', $contractor));
    }

    public function test_without_a_fee_line_the_fee_is_a_percentage_of_the_estimate(): void
    {
        $project = $this->project();
        $contractor = $this->user('contractor');

        $this->invite($project, 'contractor', $contractor);

        // 10% of ₱2,000,000.
        $this->assertSame(200000, $this->wageOf($project, 'contractor', $contractor)['amount']);
    }

    public function test_contractors_share_the_fee_and_the_split_follows_the_head_count(): void
    {
        $project = $this->project(contractorFeeLine: 300000);
        [$first, $second] = [$this->user('contractor'), $this->user('contractor')];

        $this->invite($project, 'contractor', $first);
        $this->assertSame(300000, $this->wageOf($project, 'contractor', $first)['amount']);

        $this->invite($project, 'contractor', $second);
        $this->assertSame(150000, $this->wageOf($project, 'contractor', $first)['amount']);
        $this->assertSame(150000, $this->wageOf($project, 'contractor', $second)['amount']);
    }

    public function test_a_quote_or_a_manual_fee_is_never_re_split(): void
    {
        $project = $this->project(contractorFeeLine: 300000);
        $quoted = $this->user('contractor');
        $later = $this->user('contractor');

        Sanctum::actingAs($quoted);
        $requestId = $this->postJson("/api/projects/{$project->id}/apply-contractor", ['quote_amount' => 450000])->assertCreated()->json('id');
        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/contractor-requests/{$requestId}/respond", ['decision' => 'accept'])->assertOk();

        $this->invite($project, 'contractor', $later);

        $this->assertSame(['amount' => 450000, 'unit' => 'fixed', 'days' => null, 'auto' => false], $this->wageOf($project, 'contractor', $quoted));
    }

    // ---- joining only fills the newcomer; the command fills everyone -----------------------------

    public function test_joining_fills_only_the_newcomer_not_people_whose_wage_is_blank(): void
    {
        $project = $this->project();
        $existing = $this->workerWithRate(800);
        $project->workers()->attach($existing->id);       // already on the project, no wage

        $this->invite($project, 'worker', $this->workerWithRate(800));

        $this->assertNull($this->wageOf($project, 'worker', $existing));
    }

    public function test_the_fill_command_gives_every_member_a_wage_and_is_safe_to_repeat(): void
    {
        $project = $this->project(contractorFeeLine: 300000);
        $worker = $this->workerWithRate(900);
        $contractor = $this->user('contractor');
        $manual = $this->workerWithRate(800);
        $project->workers()->attach([$worker->id, $manual->id]);
        $project->contractors()->attach($contractor->id);
        $project->workers()->updateExistingPivot($manual->id, ['wage_amount' => 1500, 'wage_unit' => 'fixed', 'wage_auto' => false]);

        $this->artisan('wages:fill')->assertSuccessful()->expectsOutputToContain('2 wages filled in');

        $this->assertSame(['amount' => 900, 'unit' => 'per_day', 'days' => 156, 'auto' => true], $this->wageOf($project, 'worker', $worker));
        $this->assertSame(['amount' => 300000, 'unit' => 'fixed', 'days' => null, 'auto' => true], $this->wageOf($project, 'contractor', $contractor));
        $this->assertSame(1500, $this->wageOf($project, 'worker', $manual)['amount']);

        $this->artisan('wages:fill')->assertSuccessful()->expectsOutputToContain('0 wages filled in');
    }

    public function test_the_fill_command_can_target_one_project(): void
    {
        $a = $this->project();
        $b = $this->project();
        $workerA = $this->workerWithRate(900);
        $workerB = $this->workerWithRate(900);
        $a->workers()->attach($workerA->id);
        $b->workers()->attach($workerB->id);

        $this->artisan('wages:fill', ['--project' => $a->id])->assertSuccessful();

        $this->assertNotNull($this->wageOf($a, 'worker', $workerA));
        $this->assertNull($this->wageOf($b, 'worker', $workerB));
    }

    public function test_a_project_with_nothing_to_base_a_fee_on_leaves_the_contractor_without_one(): void
    {
        $project = app(ProjectService::class)->createFromPlan($this->owner, [
            'projectTitle' => 'Tiny', 'budget' => 0, 'totalEstimate' => 0, 'timelineValue' => 1, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Build', 'percentComplete' => 100]],
        ]);
        $contractor = $this->user('contractor');

        $this->invite($project, 'contractor', $contractor);

        $this->assertNull($this->wageOf($project, 'contractor', $contractor));
    }

    public function test_the_homeowner_can_calculate_a_workers_wage_without_entering_amounts_or_days(): void
    {
        $project = $this->project();
        $worker = $this->workerWithRate(950);
        $project->workers()->attach($worker->id);
        Sanctum::actingAs($this->owner);

        $this->patchJson("/api/projects/{$project->id}/workers/{$worker->id}/wage", ['automatic' => true])->assertOk()
            ->assertJsonPath('wage.amount', 950)
            ->assertJsonPath('wage.days', 156)
            ->assertJsonPath('wage.total', 148200)
            ->assertJsonPath('wage.auto', true);
    }

    public function test_automatic_calculation_can_replace_a_custom_wage_and_use_the_configured_default(): void
    {
        $project = $this->project();
        $worker = $this->workerWithRate(null);
        $project->workers()->attach($worker->id, ['wage_amount' => 5000, 'wage_unit' => 'fixed', 'wage_auto' => false]);
        Sanctum::actingAs($this->owner);

        $this->patchJson("/api/projects/{$project->id}/workers/{$worker->id}/wage", ['automatic' => true])->assertOk()
            ->assertJsonPath('wage.amount', 850)
            ->assertJsonPath('wage.unit', 'per_day')
            ->assertJsonPath('wage.auto', true);
    }

    public function test_automatic_contractor_wages_use_the_accepted_quote_without_marking_it_as_an_estimate(): void
    {
        $project = $this->project(contractorFeeLine: 300000);
        $contractor = $this->user('contractor');
        $project->contractors()->attach($contractor->id);
        $project->contractorRequests()->create(['contractor_id' => $contractor->id, 'initiated_by' => 'contractor', 'status' => 'approved', 'quote_amount' => 420000]);
        Sanctum::actingAs($this->owner);

        $this->patchJson("/api/projects/{$project->id}/contractors/{$contractor->id}/wage", ['automatic' => true])->assertOk()
            ->assertJsonPath('wage.amount', 420000)
            ->assertJsonPath('wage.unit', 'fixed')
            ->assertJsonPath('wage.auto', false);

        // An old quote no longer applies after the contractor rejoins through a newer invitation.
        $project->contractorRequests()->create(['contractor_id' => $contractor->id, 'initiated_by' => 'homeowner', 'status' => 'approved']);
        $this->patchJson("/api/projects/{$project->id}/contractors/{$contractor->id}/wage", ['automatic' => true])->assertOk()
            ->assertJsonPath('wage.amount', 300000)
            ->assertJsonPath('wage.auto', true);
    }

    public function test_contractors_can_calculate_their_workers_wages_but_cannot_change_their_own_fee(): void
    {
        $project = $this->project();
        $contractor = $this->user('contractor');
        $worker = $this->workerWithRate(900);
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);
        Sanctum::actingAs($contractor);

        $this->patchJson("/api/projects/{$project->id}/workers/{$worker->id}/wage", ['automatic' => true])->assertOk()->assertJsonPath('wage.amount', 900);
        $this->patchJson("/api/projects/{$project->id}/contractors/{$contractor->id}/wage", ['automatic' => true])->assertUnprocessable();
        Sanctum::actingAs($this->user('homeowner'));
        $this->patchJson("/api/projects/{$project->id}/workers/{$worker->id}/wage", ['automatic' => true])->assertUnprocessable();
    }

    public function test_removing_a_contractor_recalculates_remaining_automatic_fees(): void
    {
        $project = $this->project(contractorFeeLine: 300000);
        $first = $this->user('contractor');
        $second = $this->user('contractor');
        $this->invite($project, 'contractor', $first);
        $this->invite($project, 'contractor', $second);
        Sanctum::actingAs($this->owner);

        $this->deleteJson("/api/projects/{$project->id}/contractors/{$second->id}")->assertSuccessful();
        $this->assertSame(300000, $this->wageOf($project, 'contractor', $first)['amount']);
    }

    public function test_automatic_mode_rejects_custom_amounts_and_does_not_invent_a_fee_without_project_data(): void
    {
        $project = app(ProjectService::class)->createFromPlan($this->owner, [
            'projectTitle' => 'No estimate', 'budget' => 0, 'totalEstimate' => 0, 'timelineValue' => 1, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Build', 'percentComplete' => 100]],
        ]);
        $contractor = $this->user('contractor');
        $project->contractors()->attach($contractor->id, ['wage_amount' => 50000, 'wage_unit' => 'fixed', 'wage_auto' => false]);
        Sanctum::actingAs($this->owner);

        $this->patchJson("/api/projects/{$project->id}/contractors/{$contractor->id}/wage", ['automatic' => true, 'amount' => 999])->assertUnprocessable();
        $this->patchJson("/api/projects/{$project->id}/contractors/{$contractor->id}/wage", ['automatic' => true])->assertUnprocessable();
        $this->assertSame(50000, $this->wageOf($project, 'contractor', $contractor)['amount']);
    }
}
