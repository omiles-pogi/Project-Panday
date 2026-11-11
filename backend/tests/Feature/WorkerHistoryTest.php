<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkerRequest;
use App\Models\User;
use App\Services\ProjectCompletionService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkerHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'worker'): User
    {
        $user = User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
        if ($role === 'worker') {
            $user->workerProfile()->create(['trade' => 'Mason', 'years_experience' => 5]);
        }
        return $user;
    }

    private function project(?User $worker = null, string $status = 'completed', ?string $confirmed = '2026-10-20 10:00:00'): Project
    {
        $project = Project::create(['user_id' => $this->user('homeowner')->id, 'title' => 'Recorded residence',
            'status' => $status, 'started_at' => '2026-01-05', 'completion_confirmed_at' => $confirmed,
            'location' => 'Recorded location', 'budget' => 1200000, 'total_estimate' => 1100000,
            'timeline_value' => 6, 'timeline_unit' => 'months', 'approved_plan' => [
                'floors' => 2, 'areaSqm' => 150, 'bedrooms' => 3, 'bathrooms' => 2,
                'designStyle' => 'Modern', 'exteriorConcept' => 'Approved exterior details.', 'interiorConcept' => 'Approved interior details.',
                'initialPrompt' => 'Initial request only', '_finalizationKey' => 'private-workflow-metadata',
            ]]);
        if ($worker) {
            $project->workers()->attach($worker);
        }

        return $project;
    }

    public function test_only_assigned_completed_projects_are_listed_newest_first_with_legacy_dates_last(): void
    {
        $worker = $this->user();
        $old = $this->project($worker, confirmed: '2026-06-10 10:00:00');
        $new = $this->project($worker);
        $legacy = $this->project($worker, confirmed: null);
        foreach (['active', 'not_started', Project::PENDING_CONFIRMATION] as $status) {
            $this->project($worker, $status);
        }
        $this->project($this->user());
        foreach (['pending', 'rejected', 'approved'] as $status) {
            ProjectWorkerRequest::create(['project_id' => $this->project()->id, 'worker_id' => $worker->id,
                'initiated_by' => 'worker', 'status' => $status]);
        }
        // Even a rogue contractor pivot is not an official worker assignment.
        $this->project()->contractors()->attach($worker);
        DB::table('projects')->where('id', $new->id)->update(['is_hidden_from_dashboard' => true]);
        Sanctum::actingAs($worker);
        $response = $this->getJson('/api/worker-history')->assertOk()->assertJsonCount(3);
        $this->assertSame([$new->id, $old->id, $legacy->id], $response->json('*.id'));
        $response->assertJsonPath('0.homeownerName', $new->user->name)->assertJsonPath('2.completedAt', null);
    }

    public function test_guests_and_all_other_roles_are_blocked(): void
    {
        $this->getJson('/api/worker-history')->assertUnauthorized();
        $this->getJson('/api/worker-history/1')->assertUnauthorized();
        foreach (array_diff(User::ROLES, ['worker']) as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/worker-history')->assertForbidden();
            $this->getJson('/api/worker-history/1')->assertForbidden();
        }
    }

    public function test_id_tampering_and_noncompleted_projects_return_not_found(): void
    {
        $worker = $this->user();
        $foreign = $this->project($this->user());
        $ongoing = $this->project($worker, 'active');
        Sanctum::actingAs($worker);
        foreach ([$foreign->id, $ongoing->id, 999999, 'invalid'] as $id) {
            $this->getJson("/api/worker-history/{$id}")->assertNotFound();
        }
    }

    public function test_details_present_only_saved_approved_specifications_without_leaking_internal_plan_data(): void
    {
        $worker = $this->user();
        $project = $this->project($worker);
        $before = $project->fresh()->getRawOriginal();
        Sanctum::actingAs($worker);
        $response = $this->getJson("/api/worker-history/{$project->id}")->assertOk()
            ->assertJsonPath('projectType', '2-storey project · Modern')->assertJsonPath('location', 'Recorded location')
            ->assertJsonPath('workerRole', 'Mason')->assertJsonMissingPath('budget')
            ->assertJsonPath('startedAt', '2026-01-05')->assertJsonMissingPath('approvedPlan')
            ->assertJsonMissingPath('_finalizationKey')->assertJsonMissingPath('homeownerEmail');
        $this->assertStringContainsString('Approved exterior details.', $response->json('description'));
        $this->assertStringContainsString('Bedrooms: 3', $response->json('description'));
        $this->assertStringNotContainsString('Initial request only', $response->getContent());
        $this->assertStringNotContainsString('private-workflow-metadata', $response->getContent());
        $this->assertSame($before, $project->fresh()->getRawOriginal());
    }

    public function test_saved_final_description_takes_priority_and_missing_information_stays_unknown(): void
    {
        $worker = $this->user();
        $project = $this->project($worker, confirmed: null);
        $project->update(['approved_plan' => ['description' => 'Final approved description.', 'exteriorConcept' => 'Other saved details.']]);
        Sanctum::actingAs($worker);
        $this->getJson("/api/worker-history/{$project->id}")->assertOk()->assertJsonPath('description', 'Final approved description.');
        $project->update(['approved_plan' => ['initialPrompt' => 'Do not use this prompt'], 'budget' => 0, 'location' => null]);
        $this->getJson("/api/worker-history/{$project->id}")->assertOk()->assertJsonPath('description', null)
            ->assertJsonPath('projectType', null)->assertJsonPath('completedAt', null)->assertJsonPath('location', null);
    }

    public function test_all_completed_records_are_returned_without_an_arbitrary_dashboard_limit(): void
    {
        $worker = $this->user();
        for ($i = 0; $i < 31; $i++) {
            $this->project($worker);
        }
        Sanctum::actingAs($worker);
        $this->getJson('/api/worker-history')->assertOk()->assertJsonCount(31);
    }

    public function test_finalizing_a_plan_and_submitting_completion_do_not_enter_history_until_owner_confirms(): void
    {
        $worker = $this->user();
        $owner = $this->user('homeowner');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'Workflow residence', 'budget' => 200000, 'totalEstimate' => 180000,
            'timelineValue' => 3, 'timelineUnit' => 'months',
            'phases' => [['name' => 'Finishing', 'percentComplete' => 100, 'tasks' => ['Final inspection', 'Site cleanup', 'Handover']]],
        ]);
        $project->workers()->attach($worker);
        Sanctum::actingAs($worker);
        $this->getJson('/api/worker-history')->assertOk()->assertJsonCount(0);
        $completion = app(ProjectCompletionService::class);
        $manager = $this->user('contractor');
        $project->contractors()->attach($manager);
        $completion->checkAll($project->fresh(), $project->phases->first(), $manager);
        $completion->submit($project->fresh(), $manager);
        $this->getJson('/api/worker-history')->assertOk()->assertJsonCount(0);
        $completion->confirm($project->fresh(), $owner);
        $this->getJson('/api/worker-history')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $project->id);
        $this->getJson("/api/worker-history/{$project->id}")->assertOk()->assertJsonPath('status', 'completed');
        $this->assertDatabaseHas('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
        $this->assertDatabaseCount('project_phase_tasks', 3);
    }
}
