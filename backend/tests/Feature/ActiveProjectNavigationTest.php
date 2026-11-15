<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\ProjectCompletionService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ActiveProjectNavigationTest extends TestCase
{
    use RefreshDatabase;

    private function project(User $owner, string $title): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => $title, 'location' => 'Recorded location', 'budget' => 900000, 'totalEstimate' => 850000,
            'timelineValue' => 6, 'timelineUnit' => 'months', 'areaSqm' => 120, 'floors' => 2,
            'phases' => [['name' => 'Construction', 'percentComplete' => 100, 'tasks' => ['Final inspection']]],
        ]);
    }

    public function test_actual_completion_excludes_active_navigation_but_keeps_history_and_all_saved_records(): void
    {
        $owner = User::factory()->create(['role' => 'homeowner']);
        $completed = $this->project($owner, 'test 2');
        $ongoing = $this->project($owner, 'Other ongoing project');
        $plan = $completed->approved_plan;
        $completion = app(ProjectCompletionService::class);
        $completion->checkAll($completed, $completed->phases->first(), $owner);
        $completion->submit($completed->fresh(), $owner);
        $this->assertSame('completed', $completed->fresh()->status);
        Sanctum::actingAs($owner);

        $this->getJson("/api/dashboard?project_id={$completed->id}&active_only=1")->assertOk()->assertJsonPath('project', null);
        $this->getJson('/api/dashboard?active_only=1')->assertOk()->assertJsonPath('project.id', $ongoing->id);
        $this->getJson("/api/dashboard?project_id={$completed->id}")->assertOk()->assertJsonPath('project.id', $completed->id);
        $this->getJson("/api/project-history/{$completed->id}")->assertOk()->assertJsonPath('project.id', $completed->id);
        $this->getJson('/api/home-dashboard')->assertOk()->assertJsonCount(1, 'ongoingProjects')->assertJsonPath('ongoingProjects.0.id', $ongoing->id);
        $this->assertSame($plan, $completed->fresh()->approved_plan);
        $this->assertDatabaseCount('projects', 2);
        $this->assertDatabaseCount('project_phase_tasks', 2);
    }

    public function test_approved_ai_plans_pending_confirmation_and_explicit_placeholders_are_not_construction_completion(): void
    {
        $owner = User::factory()->create(['role' => 'homeowner']);
        $project = $this->project($owner, 'Approved AI plan');
        Sanctum::actingAs($owner);
        $this->getJson("/api/dashboard?project_id={$project->id}&active_only=1")->assertOk()->assertJsonPath('project.status', 'active');
        $project->update(['status' => Project::PENDING_CONFIRMATION]);
        $this->getJson("/api/dashboard?project_id={$project->id}&active_only=1")->assertOk()->assertJsonPath('project.status', 'pending_confirmation');
        $project->update(['status' => 'not_started']);
        $this->getJson("/api/dashboard?project_id={$project->id}&active_only=1")->assertOk()->assertJsonPath('project.status', 'not_started');
    }

    public function test_only_completed_projects_return_an_empty_active_dashboard_and_never_another_owners_data(): void
    {
        $owner = User::factory()->create(['role' => 'homeowner']);
        $project = $this->project($owner, 'Completed record');
        $project->update(['status' => 'completed']);
        Sanctum::actingAs($owner);
        $this->getJson('/api/dashboard?active_only=1')->assertOk()->assertJsonPath('project', null);
        $other = User::factory()->create(['role' => 'homeowner']);
        $foreign = $this->project($other, 'Other owner');
        $this->getJson("/api/dashboard?project_id={$foreign->id}&active_only=1")->assertOk()->assertJsonPath('project', null);
    }
}
