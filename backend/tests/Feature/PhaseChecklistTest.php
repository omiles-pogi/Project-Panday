<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PhaseChecklistTest extends TestCase
{
    use RefreshDatabase;

    private function homeowner(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'homeowner', 'approval_status' => 'approved'], $overrides));
    }

    private function contractor(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'contractor', 'approval_status' => 'approved'], $overrides));
    }

    private function worker(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'worker', 'approval_status' => 'approved'], $overrides));
    }

    /**
     * @return array{project: Project, phase: ProjectPhase}
     */
    private function projectWithAssignedContractor(User $owner, User $contractor): array
    {
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'My House Construction',
            'location' => 'Quezon City',
            'budget' => 2500000,
            'totalEstimate' => 2420000,
            'timelineMonths' => 7,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 50],
                ['name' => 'Finishing', 'percentComplete' => 50],
            ],
        ]);
        $project->contractors()->attach($contractor->id);

        return ['project' => $project, 'phase' => $project->phases->first()];
    }

    public function test_an_assigned_contractor_can_add_a_checklist_task(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);

        Sanctum::actingAs($contractor);
        $response = $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", [
            'description' => 'Land filling',
        ]);

        $response->assertStatus(201)->assertJsonPath('description', 'Land filling')->assertJsonPath('is_done', false);
        $this->assertDatabaseHas('project_phase_tasks', ['project_phase_id' => $phase->id, 'description' => 'Land filling']);
    }

    public function test_a_non_assigned_contractor_cannot_add_a_task(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);
        $otherContractor = $this->contractor();

        Sanctum::actingAs($otherContractor);
        $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Land filling'])
            ->assertStatus(422);
    }

    public function test_the_homeowner_cannot_add_a_task(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Land filling'])
            ->assertStatus(422);
    }

    public function test_checking_off_tasks_recomputes_phase_progress(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);

        Sanctum::actingAs($contractor);
        $task1 = $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Land filling'])->json();
        $task2 = $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Excavation'])->json();

        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task1['id']}", ['is_done' => true])
            ->assertStatus(200);

        $this->assertDatabaseHas('project_phases', ['id' => $phase->id, 'progress_pct' => 50]);

        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task2['id']}", ['is_done' => true])
            ->assertStatus(200);

        $this->assertDatabaseHas('project_phases', ['id' => $phase->id, 'progress_pct' => 100]);
    }

    public function test_the_homeowner_sees_updated_progress_on_their_dashboard(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);

        Sanctum::actingAs($contractor);
        $task = $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Land filling'])->json();
        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task['id']}", ['is_done' => true])
            ->assertStatus(200);

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/dashboard');

        $response->assertStatus(200)->assertJsonPath('project.phases.0.progressPct', 100);
    }

    public function test_a_worker_assigned_to_the_project_can_see_the_updated_progress(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);
        $worker = $this->worker();
        $project->workers()->attach($worker->id);

        Sanctum::actingAs($contractor);
        $task = $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Land filling'])->json();
        $this->patchJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task['id']}", ['is_done' => true])
            ->assertStatus(200);

        Sanctum::actingAs($worker);
        $response = $this->getJson('/api/my-projects');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.phases.0.progressPct', 100)
            ->assertJsonPath('0.canManageChecklist', false);
    }

    public function test_a_contractor_sees_their_assigned_project_with_checklist_management(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project] = $this->projectWithAssignedContractor($owner, $contractor);

        Sanctum::actingAs($contractor);
        $response = $this->getJson('/api/my-projects');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $project->id)
            ->assertJsonPath('0.ownerName', $owner->name)
            ->assertJsonPath('0.canManageChecklist', true);
    }

    public function test_my_projects_requires_authentication(): void
    {
        $this->getJson('/api/my-projects')->assertStatus(401);
    }

    public function test_a_contractor_can_delete_a_task_they_added(): void
    {
        $owner = $this->homeowner();
        $contractor = $this->contractor();
        ['project' => $project, 'phase' => $phase] = $this->projectWithAssignedContractor($owner, $contractor);

        Sanctum::actingAs($contractor);
        $task = $this->postJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks", ['description' => 'Land filling'])->json();
        $this->deleteJson("/api/projects/{$project->id}/phases/{$phase->id}/tasks/{$task['id']}")->assertStatus(204);

        $this->assertDatabaseMissing('project_phase_tasks', ['id' => $task['id']]);
    }
}
