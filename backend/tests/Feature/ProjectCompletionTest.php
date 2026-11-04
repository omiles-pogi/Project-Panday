<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Project;
use App\Models\ProjectActivityLog;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectCompletionTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    /**
     * A project of 2 phases and 5 tasks, with one contractor and one worker on it.
     *
     * @return array{0: Project, 1: User, 2: User, 3: User}
     */
    private function site(): array
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'Two-Storey House', 'location' => 'Quezon City', 'budget' => 2500000, 'totalEstimate' => 2420000, 'timelineMonths' => 6,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 40, 'durationWeeks' => 10, 'tasks' => ['Excavation', 'Rebar', 'Pour concrete']],
                ['name' => 'Finishing', 'percentComplete' => 60, 'durationWeeks' => 10, 'tasks' => ['Painting', 'Final inspection']],
            ],
        ]);
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);

        return [$project, $owner, $contractor, $worker];
    }

    private function url(Project $project, string $path): string
    {
        return "/api/projects/{$project->id}/{$path}";
    }

    private function phaseUrl(Project $project, ProjectPhase $phase, string $action): string
    {
        return $this->url($project, "phases/{$phase->id}/checklist/{$action}");
    }

    /** Checks every phase's tasks, one phase at a time as the app does; answers with the last phase's response. */
    private function checkAll(User $user, Project $project)
    {
        Sanctum::actingAs($user);

        $response = null;
        foreach ($project->phases as $phase) {
            $response = $this->postJson($this->phaseUrl($project, $phase, 'check-all'));
        }

        return $response;
    }

    private function submit(User $user, Project $project)
    {
        Sanctum::actingAs($user);

        return $this->postJson($this->url($project, 'completion/submit'));
    }

    /** Checks everything and submits it, as the contractor. */
    private function submitted(): array
    {
        [$project, $owner, $contractor, $worker] = $this->site();
        $this->checkAll($contractor, $project)->assertOk();
        $this->submit($contractor, $project)->assertOk();

        return [$project, $owner, $contractor, $worker];
    }

    private function notificationsFor(User $user, string $type)
    {
        return AppNotification::where('user_id', $user->id)->where('type', $type)->get();
    }

    private function contractorView(User $contractor, Project $project): array
    {
        Sanctum::actingAs($contractor);

        return collect($this->getJson('/api/my-projects')->assertOk()->json())->firstWhere('id', $project->id);
    }

    // ---- check all / uncheck all ---------------------------------------------------------------

    public function test_check_all_completes_one_phases_tasks_and_leaves_the_others_alone(): void
    {
        [$project, , $contractor] = $this->site();
        [$foundation, $finishing] = [$project->phases[0], $project->phases[1]];
        Sanctum::actingAs($contractor);

        $this->postJson($this->phaseUrl($project, $foundation, 'check-all'))->assertOk()
            ->assertJsonPath('checklist.totalTasks', 5)
            ->assertJsonPath('checklist.doneTasks', 3)
            ->assertJsonPath('checklist.pct', 60)
            ->assertJsonPath('status', 'active');

        // A fresh read from the database, as a reload of the app would do.
        $view = $this->contractorView($contractor, $project);
        $this->assertSame(100, $view['phases'][0]['progressPct']);
        $this->assertSame([true], array_values(array_unique(array_column($view['phases'][0]['tasks'], 'isDone'))));
        $this->assertSame(0, $view['phases'][1]['progressPct']);
        $this->assertSame([false], array_values(array_unique(array_column($view['phases'][1]['tasks'], 'isDone'))));
        $this->assertSame(3, ProjectPhaseTask::where('is_done', true)->whereNotNull('completed_at')->count());

        $this->postJson($this->phaseUrl($project, $finishing, 'check-all'))->assertOk()
            ->assertJsonPath('checklist.pct', 100)
            ->assertJsonPath('overallProgressPct', 100);
    }

    public function test_check_all_goes_through_the_normal_task_update_so_each_change_is_logged_once(): void
    {
        [$project, , $contractor] = $this->site();
        $foundation = $project->phases->first();
        $foundation->tasks->first()->update(['is_done' => true, 'completed_at' => now()]);
        $foundation->recomputeProgress();
        Sanctum::actingAs($contractor);

        $this->postJson($this->phaseUrl($project, $foundation, 'check-all'))->assertOk();

        // Only the two tasks that weren't done get a log row; the one already done isn't re-logged, and
        // the other phase isn't touched.
        $logs = ProjectActivityLog::where('project_id', $project->id)->get();
        $this->assertCount(2, $logs);
        $this->assertSame([true], $logs->pluck('is_done')->unique()->all());
        $this->assertSame(['Foundation'], $logs->pluck('phase_name')->unique()->all());
    }

    public function test_uncheck_all_clears_one_phase_while_the_project_is_ongoing(): void
    {
        [$project, , $contractor] = $this->site();
        $this->checkAll($contractor, $project)->assertOk();
        [$foundation, $finishing] = [$project->phases[0], $project->phases[1]];

        $this->postJson($this->phaseUrl($project, $finishing, 'uncheck-all'))->assertOk()
            ->assertJsonPath('checklist.doneTasks', 3)
            ->assertJsonPath('checklist.pct', 60)
            ->assertJsonPath('status', 'active');
        $this->assertSame(3, ProjectPhaseTask::where('is_done', true)->count());
        $this->assertSame(3, ProjectPhaseTask::whereNotNull('completed_at')->count());

        $this->postJson($this->phaseUrl($project, $foundation, 'uncheck-all'))->assertOk()
            ->assertJsonPath('checklist.doneTasks', 0)
            ->assertJsonPath('overallProgressPct', 0);
        $this->assertSame(0, ProjectPhaseTask::where('is_done', true)->count());
        $this->assertSame(0, ProjectPhaseTask::whereNotNull('completed_at')->count());
    }

    public function test_a_phase_has_to_belong_to_the_project_in_the_url(): void
    {
        [$project, , $contractor] = $this->site();
        [$otherProject, , $otherContractor] = $this->site();
        $foreignPhase = $otherProject->phases->first();

        Sanctum::actingAs($contractor);
        $this->postJson($this->phaseUrl($project, $foreignPhase, 'check-all'))->assertNotFound();
        $this->postJson($this->phaseUrl($project, $foreignPhase, 'uncheck-all'))->assertNotFound();
        Sanctum::actingAs($otherContractor);
        $this->postJson($this->phaseUrl($project, $foreignPhase, 'check-all'))->assertNotFound();

        $this->assertSame(0, ProjectPhaseTask::where('is_done', true)->count());
    }

    public function test_reaching_100_percent_never_finishes_the_project_by_itself(): void
    {
        [$project, , $contractor] = $this->site();

        $this->checkAll($contractor, $project)->assertOk()->assertJsonPath('status', 'active');

        $this->assertSame('active', $project->fresh()->status);
        $this->assertNull($project->fresh()->finished_at);
    }

    public function test_the_progress_follows_each_single_tick_as_completed_over_total(): void
    {
        [$project, , $contractor] = $this->site();
        Sanctum::actingAs($contractor);
        $phase = $project->phases->first();

        $this->patchJson($this->url($project, "phases/{$phase->id}/tasks/{$phase->tasks[0]->id}"), ['is_done' => true])->assertOk();
        $this->assertSame(['totalTasks' => 5, 'doneTasks' => 1, 'pct' => 20], $this->contractorView($contractor, $project)['checklist']);

        $this->patchJson($this->url($project, "phases/{$phase->id}/tasks/{$phase->tasks[1]->id}"), ['is_done' => true])->assertOk();
        $this->assertSame(40, $this->contractorView($contractor, $project)['checklist']['pct']);

        $this->patchJson($this->url($project, "phases/{$phase->id}/tasks/{$phase->tasks[1]->id}"), ['is_done' => false])->assertOk();
        $this->assertSame(20, $this->contractorView($contractor, $project)['checklist']['pct']);
    }

    // ---- who may touch the checklist -----------------------------------------------------------

    public function test_only_the_assigned_contractor_can_check_or_uncheck_a_phase(): void
    {
        [$project, $owner, , $worker] = $this->site();
        $stranger = $this->user('contractor');
        $phase = $project->phases->first();

        $this->checkAll($stranger, $project)->assertStatus(422)->assertJsonPath('error', 'You are not assigned as a contractor on this project.');
        $this->postJson($this->phaseUrl($project, $phase, 'uncheck-all'))->assertStatus(422);
        foreach ([$owner, $worker] as $wrongRole) {
            $this->checkAll($wrongRole, $project)->assertForbidden();
            $this->postJson($this->phaseUrl($project, $phase, 'uncheck-all'))->assertForbidden();
        }

        $this->assertSame(0, ProjectPhaseTask::where('is_done', true)->count());
    }

    // ---- marking the project as finished -------------------------------------------------------

    public function test_a_finished_checklist_can_be_submitted_and_the_homeowner_is_told(): void
    {
        [$project, $owner, $contractor] = $this->site();
        $this->checkAll($contractor, $project)->assertOk();
        Carbon::setTestNow('2027-05-04 10:30:00');

        $this->submit($contractor, $project)->assertOk()
            ->assertJsonPath('status', 'pending_confirmation')
            ->assertJsonPath('completion.submittedBy', $contractor->name)
            ->assertJsonPath('completion.confirmedAt', null);

        $fresh = $project->fresh();
        $this->assertSame('pending_confirmation', $fresh->status);
        $this->assertSame('2027-05-04 10:30:00', $fresh->finished_at->toDateTimeString());
        $this->assertSame($contractor->id, $fresh->finished_by);
        $this->assertNull($fresh->completion_confirmed_at);

        $notice = $this->notificationsFor($owner, 'project_completion_submitted')->sole();
        $this->assertSame($project->id, $notice->data['projectId']);
        $this->assertStringContainsString('Two-Storey House', $notice->body);
    }

    public function test_the_project_cannot_be_submitted_until_every_task_is_done(): void
    {
        [$project, , $contractor] = $this->site();
        Sanctum::actingAs($contractor);
        $phase = $project->phases->first();
        $this->patchJson($this->url($project, "phases/{$phase->id}/tasks/{$phase->tasks[0]->id}"), ['is_done' => true])->assertOk();

        $this->submit($contractor, $project)->assertStatus(422)
            ->assertJsonPath('error', 'Complete every checklist task before marking the project as finished (1 of 5 done).');

        $this->assertSame('active', $project->fresh()->status);
        $this->assertSame(0, $this->notificationsFor($project->user, 'project_completion_submitted')->count());
    }

    public function test_a_project_with_no_checklist_tasks_shows_zero_and_cannot_be_finished(): void
    {
        $owner = $this->user('homeowner');
        $contractor = $this->user('contractor');
        $project = app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => 'Empty', 'location' => 'Manila', 'budget' => 1000000, 'totalEstimate' => 900000, 'timelineMonths' => 3,
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'durationWeeks' => 12, 'tasks' => []]],
        ]);
        $project->contractors()->attach($contractor->id);

        $view = $this->contractorView($contractor, $project);
        $this->assertSame(['totalTasks' => 0, 'doneTasks' => 0, 'pct' => 0], $view['checklist']);
        $this->assertFalse($view['canSubmitCompletion']);

        $this->submit($contractor, $project)->assertStatus(422)
            ->assertJsonPath('error', 'Add checklist tasks and complete them before marking the project as finished.');
        $this->assertSame('active', $project->fresh()->status);
    }

    public function test_the_finish_button_is_only_on_offer_when_everything_is_checked(): void
    {
        [$project, , $contractor] = $this->site();

        $this->assertFalse($this->contractorView($contractor, $project)['canSubmitCompletion']);
        $this->checkAll($contractor, $project)->assertOk();
        $this->assertTrue($this->contractorView($contractor, $project)['canSubmitCompletion']);
    }

    public function test_only_the_assigned_contractor_can_submit_and_only_once(): void
    {
        [$project, $owner, $contractor, $worker] = $this->site();
        $this->checkAll($contractor, $project)->assertOk();

        $this->submit($this->user('contractor'), $project)->assertStatus(422)
            ->assertJsonPath('error', 'Only a contractor assigned to this project can mark it as finished.');
        $this->submit($owner, $project)->assertForbidden();
        $this->submit($worker, $project)->assertForbidden();
        $this->assertSame('active', $project->fresh()->status);

        $this->submit($contractor, $project)->assertOk();
        $this->submit($contractor, $project)->assertStatus(422)
            ->assertJsonPath('error', 'This project has already been submitted and is waiting for the homeowner.');
        $this->assertCount(1, $this->notificationsFor($owner, 'project_completion_submitted'));
    }

    // ---- the checklist is locked once submitted or completed ------------------------------------

    public function test_a_submitted_projects_checklist_is_locked_against_every_kind_of_change(): void
    {
        [$project, , $contractor] = $this->submitted();
        $phase = $project->phases->first();
        $task = $phase->tasks->first();
        $locked = 'This project was submitted as finished, so its checklist is locked until the homeowner confirms it or asks for corrections.';
        Sanctum::actingAs($contractor);

        $this->patchJson($this->url($project, "phases/{$phase->id}/tasks/{$task->id}"), ['is_done' => false])->assertStatus(422)->assertJsonPath('error', $locked);
        $this->postJson($this->url($project, "phases/{$phase->id}/tasks"), ['description' => 'Sneak in another task'])->assertStatus(422)->assertJsonPath('error', $locked);
        $this->deleteJson($this->url($project, "phases/{$phase->id}/tasks/{$task->id}"))->assertStatus(422)->assertJsonPath('error', $locked);
        $this->postJson($this->phaseUrl($project, $phase, 'uncheck-all'))->assertStatus(422)->assertJsonPath('error', $locked);
        $this->postJson($this->phaseUrl($project, $phase, 'check-all'))->assertStatus(422);

        $this->assertSame(5, ProjectPhaseTask::where('is_done', true)->count());
        $this->assertSame(5, ProjectPhaseTask::count());

        $view = $this->contractorView($contractor, $project);
        $this->assertTrue($view['checklistLocked']);
        $this->assertFalse($view['canSubmitCompletion']);
    }

    // ---- the homeowner decides -----------------------------------------------------------------

    public function test_the_homeowner_sees_the_project_waiting_for_them(): void
    {
        [$project, $owner] = $this->submitted();
        Sanctum::actingAs($owner);

        $this->getJson("/api/dashboard?project_id={$project->id}")->assertOk()
            ->assertJsonPath('project.status', 'pending_confirmation')
            ->assertJsonPath('project.canConfirmCompletion', true)
            ->assertJsonPath('project.checklist.pct', 100)
            ->assertJsonPath('stats.active', 1)
            ->assertJsonPath('stats.completed', 0);
    }

    public function test_the_homeowner_confirms_and_the_project_is_completed_for_everyone(): void
    {
        [$project, $owner, $contractor, $worker] = $this->submitted();
        Carbon::setTestNow('2027-05-06 15:00:00');
        Sanctum::actingAs($owner);

        $this->postJson($this->url($project, 'completion/confirm'))->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('completion.confirmedAt', Carbon::now()->toIso8601String());

        $fresh = $project->fresh();
        $this->assertSame('completed', $fresh->status);
        $this->assertSame('2027-05-06 15:00:00', $fresh->completion_confirmed_at->toDateTimeString());
        $this->assertNotNull($fresh->finished_at);

        $this->assertCount(1, $this->notificationsFor($contractor, 'project_completion_confirmed'));

        $this->getJson("/api/dashboard?project_id={$project->id}")->assertOk()
            ->assertJsonPath('project.status', 'completed')
            ->assertJsonPath('project.canConfirmCompletion', false)
            ->assertJsonPath('stats.completed', 1)
            ->assertJsonPath('stats.active', 0);

        $contractorView = $this->contractorView($contractor, $project);
        $this->assertSame('completed', $contractorView['status']);
        $this->assertTrue($contractorView['checklistLocked']);
        Sanctum::actingAs($worker);
        $this->assertSame('completed', collect($this->getJson('/api/my-projects')->json())->firstWhere('id', $project->id)['status']);
    }

    public function test_a_completed_projects_checklist_stays_as_it_was(): void
    {
        [$project, $owner, $contractor] = $this->submitted();
        Sanctum::actingAs($owner);
        $this->postJson($this->url($project, 'completion/confirm'))->assertOk();

        $this->checkAll($contractor, $project)->assertStatus(422)->assertJsonPath('error', 'This project is completed, so its checklist can no longer be changed.');
        Sanctum::actingAs($contractor);
        $this->postJson($this->phaseUrl($project, $project->phases->first(), 'uncheck-all'))->assertStatus(422);
        $this->submit($contractor, $project)->assertStatus(422)->assertJsonPath('error', 'This project is already completed.');
        $this->assertSame(5, ProjectPhaseTask::where('is_done', true)->count());
    }

    public function test_the_homeowner_can_ask_for_corrections_and_the_contractor_can_work_again(): void
    {
        [$project, $owner, $contractor] = $this->submitted();
        Carbon::setTestNow('2027-05-06 15:00:00');
        Sanctum::actingAs($owner);

        $this->postJson($this->url($project, 'completion/request-corrections'), ['note' => 'The east wall needs repainting.'])->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('completion.correctionsNote', 'The east wall needs repainting.')
            ->assertJsonPath('completion.submittedAt', null);

        $fresh = $project->fresh();
        $this->assertSame('active', $fresh->status);
        $this->assertNull($fresh->finished_at);
        $this->assertNull($fresh->finished_by);
        $this->assertNull($fresh->completion_confirmed_at);
        $this->assertSame('2027-05-06 15:00:00', $fresh->corrections_requested_at->toDateTimeString());

        $notice = $this->notificationsFor($contractor, 'project_corrections_requested')->sole();
        $this->assertStringContainsString('The east wall needs repainting.', $notice->body);

        // The checklist is the contractor's again, and they see what to fix.
        $view = $this->contractorView($contractor, $project);
        $this->assertFalse($view['checklistLocked']);
        $this->assertSame('The east wall needs repainting.', $view['completion']['correctionsNote']);
        $phase = $project->phases->first();
        $this->patchJson($this->url($project, "phases/{$phase->id}/tasks/{$phase->tasks->first()->id}"), ['is_done' => false])->assertOk();
        $this->assertFalse($this->contractorView($contractor, $project)['canSubmitCompletion']);
    }

    public function test_resubmitting_after_corrections_starts_the_review_over(): void
    {
        [$project, $owner, $contractor] = $this->submitted();
        Sanctum::actingAs($owner);
        $this->postJson($this->url($project, 'completion/request-corrections'), ['note' => 'Fix the paint.'])->assertOk();

        $this->submit($contractor, $project)->assertOk()
            ->assertJsonPath('status', 'pending_confirmation')
            ->assertJsonPath('completion.correctionsNote', null);

        $this->assertCount(2, $this->notificationsFor($owner, 'project_completion_submitted'));
        Sanctum::actingAs($owner);
        $this->postJson($this->url($project, 'completion/confirm'))->assertOk()->assertJsonPath('status', 'completed');
    }

    public function test_corrections_have_to_say_what_to_fix(): void
    {
        [$project, $owner] = $this->submitted();
        Sanctum::actingAs($owner);
        $url = $this->url($project, 'completion/request-corrections');

        $this->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->postJson($url, ['note' => '  '])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->postJson($url, ['note' => 'ab'])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->postJson($url, ['note' => str_repeat('x', 1001)])->assertStatus(422)->assertJsonValidationErrors('note');

        $this->assertSame('pending_confirmation', $project->fresh()->status);
    }

    // ---- cannot be bypassed --------------------------------------------------------------------

    public function test_only_the_projects_own_homeowner_can_respond(): void
    {
        [$project, , $contractor, $worker] = $this->submitted();

        Sanctum::actingAs($this->user('homeowner'));
        $this->postJson($this->url($project, 'completion/confirm'))->assertStatus(422)
            ->assertJsonPath('error', 'Only the homeowner of this project can respond to its completion.');
        $this->postJson($this->url($project, 'completion/request-corrections'), ['note' => 'Not mine to say'])->assertStatus(422);

        foreach ([$contractor, $worker] as $other) {
            Sanctum::actingAs($other);
            $this->postJson($this->url($project, 'completion/confirm'))->assertForbidden();
            $this->postJson($this->url($project, 'completion/request-corrections'), ['note' => 'Not mine to say'])->assertForbidden();
        }

        $this->assertSame('pending_confirmation', $project->fresh()->status);
    }

    public function test_the_homeowner_cannot_confirm_a_project_that_was_never_submitted(): void
    {
        [$project, $owner, $contractor] = $this->site();
        $this->checkAll($contractor, $project)->assertOk();
        Sanctum::actingAs($owner);

        $this->postJson($this->url($project, 'completion/confirm'))->assertStatus(422)->assertJsonPath('error', 'This project is not waiting for your confirmation.');
        $this->postJson($this->url($project, 'completion/request-corrections'), ['note' => 'Too early'])->assertStatus(422);

        $this->assertSame('active', $project->fresh()->status);
        $this->assertNull($project->fresh()->completion_confirmed_at);
    }

    public function test_a_confirmed_project_cannot_be_confirmed_or_sent_back_again(): void
    {
        [$project, $owner] = $this->submitted();
        Sanctum::actingAs($owner);
        $this->postJson($this->url($project, 'completion/confirm'))->assertOk();

        $this->postJson($this->url($project, 'completion/confirm'))->assertStatus(422);
        $this->postJson($this->url($project, 'completion/request-corrections'), ['note' => 'Changed my mind'])->assertStatus(422);
        $this->assertSame('completed', $project->fresh()->status);
    }

    public function test_the_generic_endpoints_cannot_be_used_to_set_a_status(): void
    {
        [$project, $owner, $contractor] = $this->site();

        foreach ([$owner, $contractor] as $user) {
            Sanctum::actingAs($user);
            $this->patchJson("/api/projects/{$project->id}", ['status' => 'completed'])->assertStatus(405);
            $this->putJson("/api/projects/{$project->id}", ['status' => 'completed'])->assertStatus(405);
        }

        $this->assertSame('active', $project->fresh()->status);
    }

    // ---- what else sees the new status ---------------------------------------------------------

    public function test_the_team_can_only_be_rated_once_the_project_is_completed(): void
    {
        [$project, $owner, $contractor] = $this->site();
        // A task-less phase keeps the weighted progress below 100% even once everything is ticked.
        $project->phases()->create(['name' => 'Landscaping', 'sort_order' => 9, 'weight_pct' => 10, 'progress_pct' => 0]);
        $this->checkAll($contractor, $project)->assertOk();
        $this->submit($contractor, $project)->assertOk();
        Sanctum::actingAs($owner);

        $this->getJson("/api/projects/{$project->id}/ratings")->assertOk()->assertJsonPath('canRate', false);

        $this->postJson($this->url($project, 'completion/confirm'))->assertOk();
        $this->getJson("/api/projects/{$project->id}/ratings")->assertOk()->assertJsonPath('canRate', true);
    }

    public function test_a_submitted_project_is_no_longer_taking_applications_or_check_ins(): void
    {
        [$project, , , $worker] = $this->submitted();

        Sanctum::actingAs($worker);
        $this->postJson($this->url($project, 'attendance/check-in'))->assertStatus(422)->assertJsonPath('error', 'This project is not active.');
        Sanctum::actingAs($this->user('worker'));
        $this->getJson('/api/projects/available')->assertOk()->assertJsonCount(0);
    }
}
