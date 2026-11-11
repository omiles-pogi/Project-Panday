<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectActivityLog;
use App\Models\User;
use App\Services\ProjectDashboardService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner, string $title = 'Actual saved residence'): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => $title, 'location' => 'Dagupan', 'budget' => 900000, 'totalEstimate' => 850000,
            'timelineValue' => 6, 'timelineUnit' => 'months', 'floors' => 2,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 60, 'tasks' => ['Inspect foundation']],
                ['name' => 'Finishing', 'percentComplete' => 40, 'tasks' => ['Final inspection']],
            ],
        ]);
    }

    public function test_landing_cards_use_only_the_owners_visible_active_projects_and_real_progress(): void
    {
        $owner = $this->user();
        $active = $this->project($owner);
        $active->phases[0]->update(['progress_pct' => 50]);
        $active->phases[1]->update(['progress_pct' => 100]);
        $completed = $this->project($owner, 'Completed residence');
        $completed->update(['status' => 'completed', 'completion_confirmed_at' => '2026-06-01']);
        $this->project($owner)->update(['status' => Project::PENDING_CONFIRMATION, 'finished_at' => '2026-05-01']);
        $draft = app(ProjectService::class)->startDraft($owner);
        $hidden = $this->project($owner, 'Hidden residence');
        $hidden->update(['status' => 'completed', 'completion_confirmed_at' => '2026-05-01']);
        app(ProjectDashboardService::class)->hide($hidden, $owner);
        $foreign = $this->project($this->user(), 'Private other residence');
        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/home-dashboard')->assertOk()
            ->assertJsonCount(1, 'ongoingProjects')->assertJsonCount(4, 'projects')
            ->assertJsonPath('ongoingProjects.0.id', $active->id)
            ->assertJsonPath('ongoingProjects.0.title', 'Actual saved residence')
            ->assertJsonPath('ongoingProjects.0.location', 'Dagupan')
            ->assertJsonPath('ongoingProjects.0.floors', 2)->assertJsonPath('ongoingProjects.0.overallProgressPct', 70);
        $this->assertNotContains($hidden->id, $response->json('projects.*.id'));
        $this->assertNotContains($foreign->id, $response->json('projects.*.id'));
        $this->assertContains($draft->id, $response->json('projects.*.id'));
        $this->assertNotContains($hidden->id, $response->json('recentActivity.*.projectId'));
        $this->assertNotContains($foreign->id, $response->json('recentActivity.*.projectId'));
        $this->getJson('/api/project-history')->assertOk()->assertJsonCount(2);
        $this->assertDatabaseHas('projects', ['id' => $completed->id, 'status' => 'completed']);
    }

    public function test_only_homeowners_can_read_the_landing_feed(): void
    {
        $this->getJson('/api/home-dashboard')->assertUnauthorized();
        foreach (array_diff(User::ROLES, ['homeowner']) as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/home-dashboard')->assertForbidden();
        }
        Sanctum::actingAs($this->user());
        $this->getJson('/api/home-dashboard')->assertOk()->assertExactJson(['projects' => [], 'ongoingProjects' => [], 'recentActivity' => []]);
    }

    public function test_recent_activity_uses_saved_membership_completion_and_checklist_timestamps(): void
    {
        $owner = $this->user();
        $project = $this->project($owner, 'Named residence');
        $project->update(['status' => Project::PENDING_CONFIRMATION, 'finished_at' => '2026-02-05 10:00:00']);
        DB::table('projects')->where('id', $project->id)->update(['created_at' => '2026-02-01 10:00:00']);
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $project->contractors()->attach($contractor->id, ['created_at' => '2026-02-02 10:00:00', 'updated_at' => '2026-02-02 10:00:00']);
        $project->workers()->attach($worker->id, ['created_at' => '2026-02-03 10:00:00', 'updated_at' => '2026-02-03 10:00:00']);
        $log = ProjectActivityLog::create(['project_id' => $project->id, 'phase_name' => 'Foundation', 'task_description' => 'Recorded inspection', 'is_done' => true, 'overall_progress_pct' => 70]);
        DB::table('project_activity_logs')->where('id', $log->id)->update(['created_at' => '2026-02-04 10:00:00']);
        Sanctum::actingAs($owner);

        $events = $this->getJson('/api/home-dashboard')->assertOk()->assertJsonCount(0, 'ongoingProjects')->json('recentActivity');
        $this->assertSame(['project_submitted', 'task_completed', 'worker_joined', 'contractor_assigned', 'project_created'], array_column($events, 'type'));
        $this->assertStringStartsWith('2026-02-05T10:00:00', $events[0]['createdAt']);
        $this->assertStringContainsString('Recorded inspection', $events[1]['description']);
        $this->assertStringContainsString($worker->name, $events[2]['description']);
        $this->assertStringContainsString($contractor->name, $events[3]['description']);
        $this->assertNotContains('ai_plan_generated', array_column($events, 'type'));
    }

    public function test_recent_activity_is_bounded_and_newest_first(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        DB::table('projects')->where('id', $project->id)->update(['created_at' => '2025-01-01']);
        for ($day = 1; $day <= 12; $day++) {
            $log = ProjectActivityLog::create(['project_id' => $project->id, 'phase_name' => 'Build', 'task_description' => "Recorded task {$day}", 'is_done' => true, 'overall_progress_pct' => $day]);
            DB::table('project_activity_logs')->where('id', $log->id)->update(['created_at' => sprintf('2026-02-%02d 10:00:00', $day)]);
        }
        Sanctum::actingAs($owner);
        $events = $this->getJson('/api/home-dashboard')->assertOk()->assertJsonCount(8, 'recentActivity')->json('recentActivity');
        $this->assertStringContainsString('Recorded task 12', $events[0]['description']);
        $this->assertStringContainsString('Recorded task 5', $events[7]['description']);
        $dates = array_column($events, 'createdAt');
        $sorted = $dates;
        rsort($sorted);
        $this->assertSame($sorted, $dates);
    }

    public function test_unknown_dates_are_not_replaced_by_fake_events_and_reads_do_not_change_records(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        DB::table('projects')->where('id', $project->id)->update(['created_at' => null]);
        $before = DB::table('projects')->get()->toJson();
        $tasksBefore = DB::table('project_phase_tasks')->get()->toJson();
        Sanctum::actingAs($owner);
        $this->getJson('/api/home-dashboard')->assertOk()->assertJsonCount(1, 'ongoingProjects')->assertJsonCount(0, 'recentActivity');
        $this->assertSame($before, DB::table('projects')->get()->toJson());
        $this->assertSame($tasksBefore, DB::table('project_phase_tasks')->get()->toJson());
    }
}
