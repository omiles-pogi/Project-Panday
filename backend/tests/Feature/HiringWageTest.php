<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HiringWageTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        config(['wages.default_daily_rate' => 850, 'wages.working_days_per_month' => 26, 'wages.contractor_fee_pct' => 10]);
        $this->owner = $this->user('homeowner');
        $this->project = $this->projectFor($this->owner);
        Sanctum::actingAs($this->owner);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function projectFor(User $owner): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'House', 'budget' => 2000000, 'totalEstimate' => 2000000, 'timelineMonths' => 2,
            'phases' => [['name' => 'Build', 'percentComplete' => 100]],
            'budgetBreakdown' => [
                ['category' => 'Construction Materials', 'amount' => 1700000],
                ['category' => 'Contractor and Project Management Fee', 'amount' => 300000],
            ],
        ]);
    }

    private function worker(?int $rate): User
    {
        $worker = $this->user('worker');
        $worker->workerProfile()->create(['trade' => 'Mason', 'years_experience' => 5, 'min_daily_wage' => $rate]);

        return $worker;
    }

    private function contractor(): User
    {
        $contractor = $this->user('contractor');
        $contractor->contractorProfile()->create(['specialization' => 'Residential', 'years_experience' => 5]);

        return $contractor;
    }

    private function preview(): array
    {
        return $this->getJson("/api/projects/{$this->project->id}/hiring-wages")->assertOk()->json();
    }

    public function test_worker_previews_use_their_asking_rate_or_an_explicit_default_without_assigning_them(): void
    {
        $worker = $this->worker(900);
        $noRate = $this->worker(null);
        $data = $this->preview();
        $workers = collect($data['workers'])->keyBy('userId');

        $this->assertSame($this->project->id, $data['projectId']);
        $this->assertSame('worker_minimum', $workers[$worker->id]['source']);
        $this->assertSame(['amount' => 900, 'unit' => 'per_day', 'days' => 52, 'total' => 46800, 'auto' => true], $workers[$worker->id]['wage']);
        $this->assertSame('app_default', $workers[$noRate->id]['source']);
        $this->assertSame(850, $workers[$noRate->id]['wage']['amount']);
        $this->assertDatabaseCount('project_workers', 0);
        $this->assertDatabaseCount('project_contractors', 0);
    }

    public function test_assigned_wages_and_intentionally_cleared_wages_are_preserved(): void
    {
        $worker = $this->worker(900);
        $cleared = $this->worker(1000);
        $this->project->workers()->attach($worker->id, ['wage_amount' => 50000, 'wage_unit' => 'fixed', 'wage_auto' => false]);
        $this->project->workers()->attach($cleared->id);

        $workers = collect($this->preview()['workers'])->keyBy('userId');
        $this->assertSame('project', $workers[$worker->id]['source']);
        $this->assertSame(50000, $workers[$worker->id]['wage']['total']);
        $this->assertFalse($workers[$worker->id]['wage']['auto']);
        $this->assertNull($workers[$cleared->id]['wage']);
        $this->assertDatabaseHas('project_workers', ['project_id' => $this->project->id, 'worker_id' => $cleared->id, 'wage_amount' => null]);
    }

    public function test_contractor_previews_use_saved_fees_quotes_or_the_prospective_fee_split(): void
    {
        $assigned = $this->contractor();
        $candidate = $this->contractor();
        $quoted = $this->contractor();
        $this->project->contractors()->attach($assigned->id, ['wage_amount' => 42000, 'wage_unit' => 'fixed', 'wage_auto' => false]);
        $this->project->contractorRequests()->create(['contractor_id' => $quoted->id, 'initiated_by' => 'contractor', 'status' => 'pending', 'quote_amount' => 120000]);

        $contractors = collect($this->preview()['contractors'])->keyBy('userId');
        $this->assertSame('project', $contractors[$assigned->id]['source']);
        $this->assertSame(42000, $contractors[$assigned->id]['wage']['total']);
        $this->assertSame('application_quote', $contractors[$quoted->id]['source']);
        $this->assertSame(120000, $contractors[$quoted->id]['wage']['total']);
        $this->assertSame('project_estimate', $contractors[$candidate->id]['source']);
        $this->assertSame(150000, $contractors[$candidate->id]['wage']['total']);
        $this->assertTrue($contractors[$candidate->id]['wage']['auto']);
        $this->assertDatabaseCount('project_contractors', 1);
        $this->assertDatabaseHas('project_contractors', ['contractor_id' => $assigned->id, 'wage_amount' => 42000]);
    }

    public function test_wages_on_other_projects_do_not_appear_in_this_projects_preview(): void
    {
        $worker = $this->worker(900);
        $other = $this->projectFor($this->user('homeowner'));
        $other->workers()->attach($worker->id, ['wage_amount' => 999999, 'wage_unit' => 'fixed', 'wage_auto' => false]);

        $workers = collect($this->preview()['workers'])->keyBy('userId');
        $this->assertSame(46800, $workers[$worker->id]['wage']['total']);
        $this->assertSame('worker_minimum', $workers[$worker->id]['source']);
    }

    public function test_only_the_project_owner_can_read_the_preview(): void
    {
        Sanctum::actingAs($this->user('homeowner'));
        $this->getJson("/api/projects/{$this->project->id}/hiring-wages")->assertForbidden();
        Sanctum::actingAs($this->user('contractor'));
        $this->getJson("/api/projects/{$this->project->id}/hiring-wages")->assertForbidden();
    }

    public function test_an_unapproved_plan_has_no_project_wage_preview(): void
    {
        $draft = app(ProjectService::class)->startDraft($this->owner);
        $this->getJson("/api/projects/{$draft->id}/hiring-wages")->assertUnprocessable();
    }

    public function test_rates_are_refreshed_from_the_database_on_each_preview(): void
    {
        $worker = $this->worker(900);
        $first = collect($this->preview()['workers'])->keyBy('userId');
        $worker->workerProfile()->update(['min_daily_wage' => 1200]);
        $second = collect($this->preview()['workers'])->keyBy('userId');

        $this->assertSame(900, $first[$worker->id]['wage']['amount']);
        $this->assertSame(1200, $second[$worker->id]['wage']['amount']);
    }
}
