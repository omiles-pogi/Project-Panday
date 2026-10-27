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

    public function test_the_project_owner_can_invite_a_worker_who_can_accept(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($owner);
        $response = $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id]);
        $response->assertStatus(201)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('initiatedBy', 'homeowner');

        // Not assigned yet — only once the worker accepts.
        $this->assertDatabaseMissing('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $worker->id, 'type' => 'worker_invite']);

        $requestId = $response->json('id');

        Sanctum::actingAs($worker);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $owner->id, 'type' => 'worker_invite_response']);

        Sanctum::actingAs($owner);
        $this->getJson('/api/dashboard')
            ->assertStatus(200)
            ->assertJsonCount(1, 'project.workers')
            ->assertJsonPath('project.workers.0.id', $worker->id);
    }

    public function test_a_worker_can_decline_an_invite(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($owner);
        $requestId = $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->json('id');

        Sanctum::actingAs($worker);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'decline'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'rejected');

        $this->assertDatabaseMissing('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $owner->id, 'type' => 'worker_invite_response']);
    }

    public function test_inviting_a_worker_twice_is_rejected_while_pending(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertStatus(201);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertStatus(422);

        $this->assertDatabaseCount('project_worker_requests', 1);
    }

    public function test_only_the_invited_worker_can_respond_to_their_invite(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();
        $otherWorker = $this->worker();

        Sanctum::actingAs($owner);
        $requestId = $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->json('id');

        Sanctum::actingAs($otherWorker);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])->assertStatus(422);
    }

    public function test_an_assigned_contractor_can_also_invite_a_worker_to_the_project(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();
        $project->contractors()->attach($contractor->id);
        $worker = $this->worker();

        Sanctum::actingAs($contractor);
        $response = $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id]);
        $response->assertStatus(201)->assertJsonPath('status', 'pending');

        $this->assertDatabaseHas('project_worker_requests', [
            'project_id' => $project->id,
            'worker_id' => $worker->id,
            'invited_by_user_id' => $contractor->id,
        ]);

        $requestId = $response->json('id');

        Sanctum::actingAs($worker);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])->assertStatus(200);

        // The contractor who actually sent the invite is notified of the response, not
        // necessarily the homeowner.
        $this->assertDatabaseHas('app_notifications', ['user_id' => $contractor->id, 'type' => 'worker_invite_response']);
    }

    public function test_a_non_assigned_contractor_cannot_invite_a_worker(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $notAssignedContractor = $this->contractor();
        $worker = $this->worker();

        Sanctum::actingAs($notAssignedContractor);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertStatus(422);
    }

    public function test_a_worker_can_apply_to_a_project_and_the_homeowner_can_approve_it(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($worker);
        $response = $this->postJson("/api/projects/{$project->id}/apply");
        $response->assertStatus(201)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('initiatedBy', 'worker');

        $this->assertDatabaseHas('app_notifications', ['user_id' => $owner->id, 'type' => 'worker_application']);

        $requestId = $response->json('id');

        Sanctum::actingAs($owner);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $worker->id, 'type' => 'worker_application_decision']);
    }

    public function test_a_homeowner_can_reject_a_worker_application(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($worker);
        $requestId = $this->postJson("/api/projects/{$project->id}/apply")->json('id');

        Sanctum::actingAs($owner);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'decline'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'rejected');

        $this->assertDatabaseMissing('project_workers', ['project_id' => $project->id, 'worker_id' => $worker->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $worker->id, 'type' => 'worker_application_decision']);
    }

    public function test_only_the_project_owner_can_respond_to_an_application(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();
        $otherHomeowner = $this->homeowner();

        Sanctum::actingAs($worker);
        $requestId = $this->postJson("/api/projects/{$project->id}/apply")->json('id');

        Sanctum::actingAs($otherHomeowner);
        $this->patchJson("/api/worker-requests/{$requestId}/respond", ['decision' => 'accept'])->assertStatus(422);
    }

    public function test_a_worker_cannot_apply_twice_while_pending(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($worker);
        $this->postJson("/api/projects/{$project->id}/apply")->assertStatus(201);
        $this->postJson("/api/projects/{$project->id}/apply")->assertStatus(422);

        $this->assertDatabaseCount('project_worker_requests', 1);
    }

    public function test_only_worker_accounts_can_apply(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($contractor);
        $this->postJson("/api/projects/{$project->id}/apply")->assertStatus(403);
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
        $project->workers()->attach($worker->id);

        Sanctum::actingAs($owner);
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

    public function test_the_project_owner_can_invite_a_contractor_who_can_accept(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($owner);
        $response = $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $contractor->id]);
        $response->assertStatus(201)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('initiatedBy', 'homeowner');

        $this->assertDatabaseMissing('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $contractor->id, 'type' => 'contractor_invite']);

        $requestId = $response->json('id');

        Sanctum::actingAs($contractor);
        $this->patchJson("/api/contractor-requests/{$requestId}/respond", ['decision' => 'accept'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $owner->id, 'type' => 'contractor_invite_response']);

        Sanctum::actingAs($owner);
        $this->getJson('/api/dashboard')
            ->assertStatus(200)
            ->assertJsonCount(1, 'project.contractors')
            ->assertJsonPath('project.contractors.0.id', $contractor->id);
    }

    public function test_a_contractor_can_decline_an_invite(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($owner);
        $requestId = $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $contractor->id])->json('id');

        Sanctum::actingAs($contractor);
        $this->patchJson("/api/contractor-requests/{$requestId}/respond", ['decision' => 'decline'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'rejected');

        $this->assertDatabaseMissing('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);
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

    public function test_inviting_a_contractor_twice_is_rejected_while_pending(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $contractor->id])->assertStatus(201);
        $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $contractor->id])->assertStatus(422);
    }

    public function test_a_contractor_can_apply_to_a_project_with_a_quote_and_the_homeowner_can_approve_it(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($contractor);
        $response = $this->postJson("/api/projects/{$project->id}/apply-contractor", [
            'quote_amount' => 2300000,
            'estimated_days' => 180,
            'message' => 'We can start next week.',
        ]);
        $response->assertStatus(201)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('initiatedBy', 'contractor')
            ->assertJsonPath('quoteAmount', 2300000)
            ->assertJsonPath('estimatedDays', 180);

        $this->assertDatabaseHas('app_notifications', ['user_id' => $owner->id, 'type' => 'contractor_application']);

        $requestId = $response->json('id');

        Sanctum::actingAs($owner);
        $this->patchJson("/api/contractor-requests/{$requestId}/respond", ['decision' => 'accept'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $contractor->id, 'type' => 'contractor_application_decision']);
    }

    public function test_only_worker_or_contractor_accounts_can_be_invited_or_apply_respectively(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);

        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/apply-contractor")->assertStatus(403);
    }

    public function test_the_project_owner_can_unassign_a_contractor(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();
        $project->contractors()->attach($contractor->id);

        Sanctum::actingAs($owner);
        $this->deleteJson("/api/projects/{$project->id}/contractors/{$contractor->id}")->assertStatus(204);

        $this->assertDatabaseMissing('project_contractors', ['project_id' => $project->id, 'contractor_id' => $contractor->id]);
    }

    public function test_the_project_owner_can_delete_their_project(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);

        Sanctum::actingAs($owner);
        $this->deleteJson("/api/projects/{$project->id}")->assertStatus(204);

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    }

    public function test_only_the_project_owner_can_delete_it(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $otherHomeowner = $this->homeowner();

        Sanctum::actingAs($otherHomeowner);
        $this->deleteJson("/api/projects/{$project->id}")->assertStatus(422);

        $this->assertDatabaseHas('projects', ['id' => $project->id]);
    }

    public function test_deleting_a_project_removes_it_from_assigned_contractors_and_workers(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();
        $worker = $this->worker();
        $project->workers()->attach($worker->id);
        $project->contractors()->attach($contractor->id);

        Sanctum::actingAs($owner);
        $anotherWorker = $this->worker();
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $anotherWorker->id])->assertStatus(201);
        $anotherContractor = $this->contractor();
        $this->postJson("/api/projects/{$project->id}/contractors", ['contractor_id' => $anotherContractor->id])->assertStatus(201);

        $this->deleteJson("/api/projects/{$project->id}")->assertStatus(204);

        $this->assertDatabaseMissing('project_contractors', ['project_id' => $project->id]);
        $this->assertDatabaseMissing('project_workers', ['project_id' => $project->id]);
        $this->assertDatabaseMissing('project_worker_requests', ['project_id' => $project->id]);
        $this->assertDatabaseMissing('project_contractor_requests', ['project_id' => $project->id]);

        Sanctum::actingAs($contractor);
        $this->getJson('/api/my-projects')->assertStatus(200)->assertJsonCount(0);

        Sanctum::actingAs($worker);
        $this->getJson('/api/my-projects')->assertStatus(200)->assertJsonCount(0);
    }

    public function test_deleting_a_project_requires_authentication(): void
    {
        $owner = $this->homeowner();
        $project = app(ProjectService::class)->createFromPlan($owner, $this->planPayload());

        $this->deleteJson("/api/projects/{$project->id}")->assertStatus(401);
    }

    public function test_a_worker_can_browse_active_projects_they_are_not_assigned_to(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();

        Sanctum::actingAs($worker);
        $response = $this->getJson('/api/projects/available');

        $response->assertStatus(200)->assertJsonCount(1);
        $response->assertJsonPath('0.id', $project->id)
            ->assertJsonPath('0.title', $project->title)
            ->assertJsonPath('0.ownerName', $owner->name)
            ->assertJsonPath('0.workerCount', 0)
            ->assertJsonPath('0.contractorCount', 0);
    }

    public function test_browsing_excludes_projects_the_worker_is_already_assigned_to(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $worker = $this->worker();
        $project->workers()->attach($worker->id);

        Sanctum::actingAs($worker);
        $this->getJson('/api/projects/available')->assertStatus(200)->assertJsonCount(0);
    }

    public function test_browsing_excludes_completed_projects(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $project->update(['status' => 'completed']);
        $worker = $this->worker();

        Sanctum::actingAs($worker);
        $this->getJson('/api/projects/available')->assertStatus(200)->assertJsonCount(0);
    }

    public function test_browsing_available_projects_requires_authentication(): void
    {
        $this->getJson('/api/projects/available')->assertStatus(401);
    }

    public function test_a_contractor_can_browse_available_projects_they_are_not_assigned_to(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();

        Sanctum::actingAs($contractor);
        $response = $this->getJson('/api/projects/available-for-contractors');

        $response->assertStatus(200)->assertJsonCount(1);
        $response->assertJsonPath('0.id', $project->id)->assertJsonPath('0.ownerName', $owner->name);
    }

    public function test_contractor_browsing_excludes_projects_they_are_already_assigned_to(): void
    {
        $owner = $this->homeowner();
        $project = $this->createProject($owner);
        $contractor = $this->contractor();
        $project->contractors()->attach($contractor->id);

        Sanctum::actingAs($contractor);
        $this->getJson('/api/projects/available-for-contractors')->assertStatus(200)->assertJsonCount(0);
    }

    public function test_browsing_available_projects_for_contractors_requires_authentication(): void
    {
        $this->getJson('/api/projects/available-for-contractors')->assertStatus(401);
    }
}
