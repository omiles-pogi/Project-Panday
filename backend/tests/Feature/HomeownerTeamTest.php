<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectWorkerRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeownerTeamTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'homeowner', string $approval = 'approved'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => $approval]);
    }

    private function project(User $owner, string $status = 'active'): Project
    {
        return Project::create(['user_id' => $owner->id, 'title' => 'Recorded project', 'status' => $status,
            'budget' => 500000, 'total_estimate' => 450000, 'timeline_value' => 6, 'timeline_unit' => 'months',
            'started_at' => '2026-11-01', 'approved_plan' => ['budgetBreakdown' => [], 'phases' => [['name' => 'Masonry']]]]);
    }

    public function test_snapshot_counts_only_this_projects_accepted_members_and_pending_requests(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $other = $this->project($owner);
        $worker = $this->user('worker');
        $worker->workerProfile()->create(['trade' => 'Mason', 'years_experience' => 3, 'min_daily_wage' => 650]);
        $worker->workerProfile->skills()->create(['skill' => 'Masonry']);
        $worker->ratingsReceived()->create(['rater_id' => $owner->id, 'score' => 4, 'comment' => 'Recorded review']);
        $contractor = $this->user('contractor');
        $project->workers()->attach($worker);
        $project->contractors()->attach($contractor);
        $project->workerRequests()->create(['worker_id' => $worker->id, 'initiated_by' => 'homeowner', 'status' => 'approved']);
        $pending = $this->user('worker');
        $project->workerRequests()->create(['worker_id' => $pending->id, 'initiated_by' => 'worker', 'status' => 'pending']);
        $project->contractorRequests()->create(['contractor_id' => $this->user('contractor')->id, 'initiated_by' => 'homeowner', 'status' => 'pending']);
        $other->workers()->attach($this->user('worker'));
        $other->workerRequests()->create(['worker_id' => $this->user('worker')->id, 'initiated_by' => 'homeowner', 'status' => 'pending']);
        $original = $project->fresh()->getRawOriginal();
        Sanctum::actingAs($owner);
        $response = $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()
            ->assertJsonPath('metrics.total', 2)->assertJsonPath('metrics.active', 2)
            ->assertJsonPath('metrics.pending', 2)->assertJsonPath('metrics.needed', null)
            ->assertJsonCount(2, 'team')->assertJsonCount(1, 'pendingWorkers')
            ->assertJsonPath('team.0.id', $worker->id)->assertJsonPath('team.0.trade', 'Mason')
            ->assertJsonPath('team.0.averageRating', 4)->assertJsonPath('team.0.ratingCount', 1)
            ->assertJsonPath('team.0.skills.0', 'Masonry')->assertJsonPath('team.0.minDailyWage', 650)
            ->assertJsonPath('team.0.status', 'Assigned')->assertJsonPath('pendingWorkers.0.initiatedBy', 'worker');
        $this->assertArrayNotHasKey('email', $response->json('team.0'));
        $this->assertArrayNotHasKey('profile_photo_path', $response->json('team.0'));
        $this->assertSame($original, $project->fresh()->getRawOriginal());
    }

    public function test_pending_or_rejected_applications_are_not_team_members_and_drafts_are_not_hiring_ready(): void
    {
        $owner = $this->user();
        $project = $this->project($owner, 'not_started');
        foreach (['pending', 'rejected', 'approved'] as $status) {
            ProjectWorkerRequest::create(['project_id' => $project->id, 'worker_id' => $this->user('worker')->id, 'initiated_by' => 'worker', 'status' => $status]);
        }
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()->assertJsonCount(0, 'team')
            ->assertJsonPath('metrics.total', 0)->assertJsonPath('metrics.active', 0)->assertJsonPath('metrics.pending', 1)->assertJsonPath('canInvite', false);
    }

    public function test_foreign_and_completed_projects_cannot_be_loaded_as_the_active_team_and_history_is_unchanged(): void
    {
        $owner = $this->user();
        $completed = $this->project($owner, 'completed');
        $completed->workers()->attach($this->user('worker'));
        $foreign = $this->project($this->user());
        Sanctum::actingAs($owner);
        foreach ([$completed->id, $foreign->id, 999999, 'invalid'] as $id) {
            $this->getJson("/api/projects/{$id}/team-overview")->assertNotFound();
        }
        $this->getJson("/api/project-history/{$completed->id}")->assertOk();
        $this->assertSame(1, $completed->workers()->count());
    }

    public function test_only_authenticated_homeowners_can_read_the_overview(): void
    {
        $project = $this->project($this->user());
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertUnauthorized();
        foreach (['contractor', 'worker', 'supplier', 'superadmin'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson("/api/projects/{$project->id}/team-overview")->assertForbidden();
        }
    }

    public function test_the_existing_invitation_workflow_updates_pending_without_joining_and_rejects_duplicates(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $worker = $this->user('worker');
        Sanctum::actingAs($owner);
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertCreated();
        $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $worker->id])->assertUnprocessable();
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()->assertJsonPath('metrics.pending', 1)->assertJsonPath('metrics.total', 0);
        $this->assertDatabaseCount('project_worker_requests', 1);
        $request = $project->workerRequests()->firstOrFail();
        Sanctum::actingAs($worker);
        $this->patchJson("/api/worker-requests/{$request->id}/respond", ['decision' => 'accept'])->assertOk();
        Sanctum::actingAs($owner);
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()->assertJsonPath('metrics.pending', 0)->assertJsonPath('metrics.total', 1);
        $this->postJson('/api/conversations', ['project_id' => $project->id, 'worker_id' => $worker->id])->assertSuccessful();
    }

    public function test_invitations_reject_unapproved_workers_and_other_roles(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        Sanctum::actingAs($owner);
        foreach ([['worker', 'pending'], ['worker', 'rejected'], ['supplier', 'approved']] as [$role, $status]) {
            $this->postJson("/api/projects/{$project->id}/workers", ['worker_id' => $this->user($role, $status)->id])->assertUnprocessable();
        }
        $this->assertDatabaseCount('project_worker_requests', 0);
    }
}
