<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;

    private function homeowner(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'homeowner', 'approval_status' => 'approved'], $overrides));
    }

    private function worker(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'worker', 'approval_status' => 'approved'], $overrides));
    }

    private function contractor(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'contractor', 'approval_status' => 'approved'], $overrides));
    }

    private function createProject(User $owner): Project
    {
        Sanctum::actingAs($owner);
        $id = $this->postJson('/api/projects', $this->planPayload())->json('id');

        return Project::findOrFail($id);
    }

    /**
     * @return array<string, mixed>
     */
    private function planPayload(): array
    {
        return [
            'projectTitle' => 'My House Construction',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 7,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 20],
                ['name' => 'Structural Works', 'percentComplete' => 30],
                ['name' => 'Finishing', 'percentComplete' => 50],
            ],
        ];
    }

    public function test_a_project_can_be_created_from_an_approved_plan(): void
    {
        $user = $this->homeowner();
        $token = $user->createToken('mobile')->plainTextToken;

        $response = $this->postJson('/api/projects', $this->planPayload(), [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('title', 'My House Construction')
            ->assertJsonPath('status', 'active')
            ->assertJsonCount(3, 'phases');

        $this->assertDatabaseHas('projects', ['user_id' => $user->id, 'title' => 'My House Construction']);
        $this->assertDatabaseHas('project_phases', ['name' => 'Foundation', 'weight_pct' => 20, 'progress_pct' => 0]);
    }

    public function test_creating_a_project_requires_authentication(): void
    {
        $this->postJson('/api/projects', $this->planPayload())->assertStatus(401);
    }

    public function test_ai_suggested_phase_tasks_are_preset_as_an_unchecked_checklist(): void
    {
        $user = $this->homeowner();
        $token = $user->createToken('mobile')->plainTextToken;

        $payload = $this->planPayload();
        $payload['phases'][0]['tasks'] = ['Site clearing', 'Land filling', 'Excavation'];

        $response = $this->postJson('/api/projects', $payload, ['Authorization' => "Bearer {$token}"]);
        $response->assertStatus(201);

        $phaseId = $response->json('phases.0.id');
        $this->assertDatabaseCount('project_phase_tasks', 3);
        $this->assertDatabaseHas('project_phase_tasks', [
            'project_phase_id' => $phaseId,
            'description' => 'Land filling',
            'is_done' => false,
            'added_by' => $user->id,
        ]);
    }

    public function test_a_project_with_no_phase_tasks_still_creates_successfully(): void
    {
        $user = $this->homeowner();
        $token = $user->createToken('mobile')->plainTextToken;

        $this->postJson('/api/projects', $this->planPayload(), ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201);

        $this->assertDatabaseCount('project_phase_tasks', 0);
    }

    public function test_dashboard_returns_null_project_when_the_user_has_none(): void
    {
        $user = $this->homeowner();
        $token = $user->createToken('mobile')->plainTextToken;

        $response = $this->getJson('/api/dashboard', ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)
            ->assertJsonPath('project', null)
            ->assertJsonPath('stats.active', 0)
            ->assertJsonPath('stats.completed', 0);
    }

    public function test_dashboard_returns_the_latest_project_with_overall_progress(): void
    {
        $user = $this->homeowner();
        $token = $user->createToken('mobile')->plainTextToken;

        $this->postJson('/api/projects', $this->planPayload(), ['Authorization' => "Bearer {$token}"]);

        $response = $this->getJson('/api/dashboard', ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)
            ->assertJsonPath('project.title', 'My House Construction')
            ->assertJsonPath('project.overallProgressPct', 0)
            ->assertJsonPath('stats.active', 1);
    }

    public function test_dashboard_requires_authentication(): void
    {
        $this->getJson('/api/dashboard')->assertStatus(401);
    }

    public function test_the_project_owner_can_assign_a_worker(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])
            ->assertStatus(204);

        $this->assertDatabaseHas('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);

        $response = $this->getJson('/api/dashboard');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'project.workers')
            ->assertJsonPath('project.workers.0.id', $worker->id);
    }

    public function test_assigning_a_worker_is_idempotent(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertStatus(204);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertStatus(204);

        $this->assertDatabaseCount('project_workers', 1);
    }

    public function test_only_the_project_owner_can_assign_a_worker(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();
        $otherHomeowner = $this->homeowner();

        Sanctum::actingAs($otherHomeowner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])
            ->assertStatus(422);
    }

    public function test_only_worker_role_accounts_can_be_assigned(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $notAWorker = $this->homeowner();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $notAWorker->id])
            ->assertStatus(422);
    }

    public function test_the_project_owner_can_unassign_a_worker(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertStatus(204);
        $this->deleteJson("/api/projects/{$project->id}/workers/{$worker->id}")->assertStatus(204);

        $this->assertDatabaseMissing('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
    }

    public function test_assigning_a_worker_requires_authentication(): void
    {
        // Created directly via the service (not the createProject() HTTP helper) so no
        // Sanctum::actingAs() call precedes this request — that state would otherwise
        // persist for the rest of the test method and defeat the "no auth" assertion.
        $owner = $this->homeowner();
        $project = app(ProjectService::class)->createFromPlan($owner, $this->planPayload());
        $worker = $this->worker();

        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])
            ->assertStatus(401);
    }

    public function test_the_project_owner_can_assign_a_contractor(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $contractor->id])
            ->assertStatus(204);

        $this->assertDatabaseHas('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);

        $response = $this->getJson('/api/dashboard');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'project.contractors')
            ->assertJsonPath('project.contractors.0.id', $contractor->id);
    }

    public function test_only_contractor_role_accounts_can_be_assigned_as_contractors(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $notAContractor = $this->worker();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $notAContractor->id])
            ->assertStatus(422);
    }

    public function test_the_project_owner_can_unassign_a_contractor(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $contractor->id])->assertStatus(204);
        $this->deleteJson("/api/projects/{$project->id}/contractors/{$contractor->id}")->assertStatus(204);

        $this->assertDatabaseMissing('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);
    }
}
