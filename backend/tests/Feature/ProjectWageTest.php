<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectWageTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $contractor;

    private User $otherContractor;

    private User $worker;

    private User $otherWorker;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = $this->user('homeowner');
        $this->contractor = $this->user('contractor');
        $this->otherContractor = $this->user('contractor');
        $this->worker = $this->user('worker');
        $this->otherWorker = $this->user('worker');

        $this->project = app(ProjectService::class)->createFromPlan($this->owner, [
            'projectTitle' => 'My House', 'budget' => 0, 'totalEstimate' => 2000000, 'timelineMonths' => 6,
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'tasks' => ['Pour slab']]],
        ]);
        $this->project->contractors()->attach([$this->contractor->id, $this->otherContractor->id]);
        $this->project->workers()->attach([$this->worker->id, $this->otherWorker->id]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function setWorkerWage(User $worker, array $body)
    {
        return $this->patchJson("/api/projects/{$this->project->id}/workers/{$worker->id}/wage", $body);
    }

    private function setContractorWage(User $contractor, array $body)
    {
        return $this->patchJson("/api/projects/{$this->project->id}/contractors/{$contractor->id}/wage", $body);
    }

    private function dashboardProject(): array
    {
        return $this->getJson("/api/dashboard?project_id={$this->project->id}")->assertOk()->json('project');
    }

    // ---- setting wages -------------------------------------------------------------------------

    public function test_the_homeowner_sets_a_contractors_fixed_fee(): void
    {
        Sanctum::actingAs($this->owner);

        $this->setContractorWage($this->contractor, ['amount' => 350000, 'unit' => 'fixed'])
            ->assertOk()
            ->assertJsonPath('wage.amount', 350000)
            ->assertJsonPath('wage.unit', 'fixed')
            ->assertJsonPath('wage.days', null)
            ->assertJsonPath('wage.total', 350000);
    }

    public function test_a_day_rate_is_multiplied_by_the_days_it_covers(): void
    {
        Sanctum::actingAs($this->owner);

        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day', 'days' => 30])
            ->assertOk()
            ->assertJsonPath('wage.total', 25500)
            ->assertJsonPath('wage.days', 30);
    }

    public function test_a_contractor_on_the_project_can_set_a_workers_wage(): void
    {
        Sanctum::actingAs($this->contractor);

        $this->setWorkerWage($this->worker, ['amount' => 900, 'unit' => 'per_day', 'days' => 10])->assertOk();
        $this->assertSame(900, $this->project->workers()->whereKey($this->worker->id)->first()->pivot->wage_amount);
    }

    public function test_only_the_homeowner_can_set_a_contractors_wage_not_even_that_contractor(): void
    {
        Sanctum::actingAs($this->contractor);
        $this->setContractorWage($this->contractor, ['amount' => 999999, 'unit' => 'fixed'])->assertStatus(422);
        $this->setContractorWage($this->otherContractor, ['amount' => 1, 'unit' => 'fixed'])->assertStatus(422);

        $this->assertNull($this->project->contractors()->whereKey($this->contractor->id)->first()->pivot->wage_amount);
    }

    public function test_workers_and_other_homeowners_cannot_set_wages(): void
    {
        Sanctum::actingAs($this->worker);
        $this->setWorkerWage($this->worker, ['amount' => 5000, 'unit' => 'per_day', 'days' => 5])->assertStatus(422);

        Sanctum::actingAs($this->user('homeowner'));
        $this->setWorkerWage($this->worker, ['amount' => 5000, 'unit' => 'per_day', 'days' => 5])->assertStatus(422);

        Sanctum::actingAs($this->user('contractor'));
        $this->setWorkerWage($this->worker, ['amount' => 5000, 'unit' => 'per_day', 'days' => 5])->assertStatus(422);

        $this->assertNull($this->project->workers()->whereKey($this->worker->id)->first()->pivot->wage_amount);
    }

    public function test_a_wage_can_only_be_set_for_someone_on_the_project(): void
    {
        Sanctum::actingAs($this->owner);

        $this->setWorkerWage($this->user('worker'), ['amount' => 800, 'unit' => 'per_day', 'days' => 5])->assertStatus(422);
        $this->setContractorWage($this->user('contractor'), ['amount' => 800, 'unit' => 'fixed'])->assertStatus(422);
    }

    public function test_a_day_rate_needs_its_days_and_values_must_be_sane(): void
    {
        Sanctum::actingAs($this->owner);

        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day'])->assertStatus(422)->assertJsonValidationErrors('days');
        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'hourly', 'days' => 3])->assertStatus(422)->assertJsonValidationErrors('unit');
        $this->setWorkerWage($this->worker, ['amount' => -5, 'unit' => 'fixed'])->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day', 'days' => 0])->assertStatus(422);
        $this->setWorkerWage($this->worker, ['amount' => 850])->assertStatus(422)->assertJsonValidationErrors('unit');
    }

    public function test_switching_to_a_fixed_fee_drops_the_days(): void
    {
        Sanctum::actingAs($this->owner);
        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day', 'days' => 30])->assertOk();

        $this->setWorkerWage($this->worker, ['amount' => 20000, 'unit' => 'fixed', 'days' => 30])
            ->assertOk()
            ->assertJsonPath('wage.days', null)
            ->assertJsonPath('wage.total', 20000);
    }

    public function test_a_wage_can_be_cleared(): void
    {
        Sanctum::actingAs($this->owner);
        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day', 'days' => 30])->assertOk();

        $this->setWorkerWage($this->worker, ['amount' => null])->assertOk()->assertJsonPath('wage', null);
        $this->assertNull($this->project->workers()->whereKey($this->worker->id)->first()->pivot->wage_amount);
    }

    public function test_the_member_is_told_when_their_wage_is_set(): void
    {
        Sanctum::actingAs($this->owner);
        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day', 'days' => 30])->assertOk();

        $note = $this->worker->appNotifications()->where('type', 'wage_set')->first();
        $this->assertNotNull($note);
        $this->assertStringContainsString('₱850/day × 30 days = ₱25,500', $note->body);
        $this->assertSame($this->project->id, $note->data['projectId']);
    }

    // ---- who sees what -------------------------------------------------------------------------

    private function paidTeam(): void
    {
        Sanctum::actingAs($this->owner);
        $this->setContractorWage($this->contractor, ['amount' => 300000, 'unit' => 'fixed'])->assertOk();
        $this->setContractorWage($this->otherContractor, ['amount' => 200000, 'unit' => 'fixed'])->assertOk();
        $this->setWorkerWage($this->worker, ['amount' => 850, 'unit' => 'per_day', 'days' => 20])->assertOk();
        $this->setWorkerWage($this->otherWorker, ['amount' => 700, 'unit' => 'per_day', 'days' => 10])->assertOk();
    }

    public function test_the_homeowner_sees_every_wage_and_the_team_total(): void
    {
        $this->paidTeam();

        $project = $this->dashboardProject();

        $wages = collect($project['contractors'])->concat($project['workers'])->mapWithKeys(fn ($m) => [$m['id'] => $m['wage']['total']]);
        $this->assertSame(300000, $wages[$this->contractor->id]);
        $this->assertSame(200000, $wages[$this->otherContractor->id]);
        $this->assertSame(17000, $wages[$this->worker->id]);
        $this->assertSame(7000, $wages[$this->otherWorker->id]);
        $this->assertSame(524000, $project['teamWageTotal']);
    }

    public function test_a_contractor_sees_the_workers_wages_and_their_own_fee_but_not_another_contractors(): void
    {
        $this->paidTeam();
        Sanctum::actingAs($this->contractor);

        $mine = collect($this->getJson('/api/my-projects')->assertOk()->json())->firstWhere('id', $this->project->id);

        $this->assertSame(300000, $mine['myWage']['total']);
        $this->assertSame(300000, collect($mine['contractors'])->firstWhere('id', $this->contractor->id)['wage']['total']);
        $this->assertNull(collect($mine['contractors'])->firstWhere('id', $this->otherContractor->id)['wage']);
        $this->assertSame(17000, collect($mine['workers'])->firstWhere('id', $this->worker->id)['wage']['total']);
        $this->assertSame(7000, collect($mine['workers'])->firstWhere('id', $this->otherWorker->id)['wage']['total']);
        $this->assertNull($mine['teamWageTotal']);
    }

    public function test_a_worker_sees_only_their_own_wage(): void
    {
        $this->paidTeam();
        Sanctum::actingAs($this->worker);

        $mine = collect($this->getJson('/api/my-projects')->assertOk()->json())->firstWhere('id', $this->project->id);

        $this->assertSame(17000, $mine['myWage']['total']);
        $this->assertSame(20, $mine['myWage']['days']);
        $this->assertNull(collect($mine['workers'])->firstWhere('id', $this->otherWorker->id)['wage']);
        foreach ($mine['contractors'] as $contractor) {
            $this->assertNull($contractor['wage']);
        }
        $this->assertNull($mine['teamWageTotal']);
    }

    public function test_a_member_with_no_wage_yet_shows_none(): void
    {
        Sanctum::actingAs($this->worker);

        $mine = collect($this->getJson('/api/my-projects')->assertOk()->json())->firstWhere('id', $this->project->id);
        $this->assertNull($mine['myWage']);

        Sanctum::actingAs($this->owner);
        $this->assertSame(0, $this->dashboardProject()['teamWageTotal']);
    }

    // ---- a contractor's quote becomes their fee ------------------------------------------------

    public function test_an_approved_contractor_application_starts_at_the_quote_as_a_fixed_fee(): void
    {
        $applicant = $this->user('contractor');
        Sanctum::actingAs($applicant);
        $requestId = $this->postJson("/api/projects/{$this->project->id}/apply-contractor", ['quote_amount' => 450000, 'estimated_days' => 120, 'message' => 'Happy to build it'])
            ->assertCreated()->json('id');

        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/contractor-requests/{$requestId}/respond", ['decision' => 'accept'])->assertOk();

        $wage = collect($this->dashboardProject()['contractors'])->firstWhere('id', $applicant->id)['wage'];
        // An agreed quote, not something the app worked out — so it is not flagged automatic.
        $this->assertSame(['amount' => 450000, 'unit' => 'fixed', 'days' => null, 'total' => 450000, 'auto' => false], $wage);
    }

    public function test_an_invited_contractor_arrives_with_a_fee_worked_out_automatically(): void
    {
        $invitee = $this->user('contractor');
        Sanctum::actingAs($this->owner);
        $requestId = $this->postJson("/api/projects/{$this->project->id}/contractors", ['contractor_id' => $invitee->id])->assertCreated()->json('id');

        Sanctum::actingAs($invitee);
        $this->patchJson("/api/contractor-requests/{$requestId}/respond", ['decision' => 'accept'])->assertOk();

        Sanctum::actingAs($this->owner);
        $wage = collect($this->dashboardProject()['contractors'])->firstWhere('id', $invitee->id)['wage'];
        $this->assertSame('fixed', $wage['unit']);
        $this->assertTrue($wage['auto']);
        $this->assertGreaterThan(0, $wage['amount']);
    }
}
