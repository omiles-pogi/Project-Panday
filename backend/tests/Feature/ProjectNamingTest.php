<?php

namespace Tests\Feature;

use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\ProjectPhaseTask;
use App\Models\SupplierFulfillment;
use App\Models\User;
use App\Services\ProjectCompletionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectNamingTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_name_a_project(): void
    {
        $this->patchJson('/api/projects/1/name', ['name' => 'My Residence'])->assertUnauthorized();
    }

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function plan(string $key = 'conversation-finalization-key-1'): array
    {
        return [
            'projectTitle' => 'AI generated house', 'location' => 'Dagupan',
            'budget' => 900000, 'totalEstimate' => 850000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'areaSqm' => 100, 'floors' => 1, 'bedrooms' => 2, 'bathrooms' => 1,
            'designStyle' => 'Modern', 'exteriorConcept' => 'Existing exterior', 'interiorConcept' => 'Existing interior',
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'tasks' => ['Final inspection']]],
            'materials' => [], 'budgetBreakdown' => [], 'finalization_key' => $key,
        ];
    }

    private function finalize(User $owner): int
    {
        Sanctum::actingAs($owner);

        return $this->postJson('/api/projects', $this->plan())->assertCreated()
            ->assertJsonPath('status', 'active')->assertJsonPath('projectNamePending', true)->json('id');
    }

    public function test_successful_finalization_exposes_pending_naming_and_a_save_changes_only_the_existing_name(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        $before = Project::findOrFail($id);
        $phases = $before->phases->pluck('id')->all();
        $this->getJson("/api/dashboard?project_id={$id}")->assertOk()->assertJsonPath('project.projectNamePending', true);

        $this->patchJson("/api/projects/{$id}/name", ['name' => "  Padlan\u{00A0}  Residence  ", 'status' => 'completed', 'budget' => 1])
            ->assertOk()->assertJsonPath('id', $id)->assertJsonPath('title', 'Padlan Residence')
            ->assertJsonPath('status', 'active')->assertJsonPath('projectNamePending', false);
        $saved = Project::findOrFail($id);
        $this->assertSame(1, $owner->projects()->count());
        $this->assertSame($before->budget, $saved->budget);
        $this->assertSame($before->started_at->toDateString(), $saved->started_at->toDateString());
        $this->assertSame($phases, $saved->phases->pluck('id')->all());
        $this->assertSame('Padlan Residence', $saved->approved_plan['projectTitle']);
        $this->assertSame('Existing exterior', $saved->approved_plan['exteriorConcept']);
        Sanctum::actingAs($owner->fresh());
        $this->getJson("/api/dashboard?project_id={$id}")->assertOk()
            ->assertJsonPath('project.title', 'Padlan Residence')->assertJsonPath('project.projectNamePending', false);
        $this->getJson('/api/projects')->assertOk()->assertJsonPath('0.title', 'Padlan Residence');
    }

    public function test_whitespace_invalid_names_and_unfinalized_or_missing_projects_are_rejected(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        foreach (['', '   ', "\t\n", "\u{00A0}\u{2003}", "\u{200B}", str_repeat('x', 256)] as $name) {
            $this->patchJson("/api/projects/{$id}/name", ['name' => $name])->assertUnprocessable()->assertJsonValidationErrors('name');
        }
        $this->assertSame('AI generated house', Project::findOrFail($id)->title);
        $draft = $this->postJson('/api/projects/draft')->assertCreated()->json('id');
        $this->patchJson("/api/projects/{$draft}/name", ['name' => 'My house'])->assertUnprocessable()->assertJsonValidationErrors('project_id');
        $this->assertDatabaseHas('projects', ['id' => $draft, 'status' => 'not_started']);
        $this->patchJson('/api/projects/999999/name', ['name' => 'My house'])->assertNotFound();
    }

    public function test_only_the_homeowner_who_owns_the_project_can_name_it(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        Sanctum::actingAs($this->user());
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'Unrelated house'])->assertNotFound();
        foreach (array_diff(User::ROLES, ['homeowner']) as $role) {
            Sanctum::actingAs($this->user($role));
            $this->patchJson("/api/projects/{$id}/name", ['name' => 'Unrelated house'])->assertForbidden();
        }
        $this->assertSame('AI generated house', Project::findOrFail($id)->title);
    }

    public function test_a_retried_save_is_idempotent_and_a_stale_different_name_cannot_overwrite_it(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'My Residence'])->assertOk();
        $before = Project::findOrFail($id)->getRawOriginal();
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'My Residence'])->assertOk()->assertJsonPath('projectNamePending', false);
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'Stale name'])->assertUnprocessable();
        $this->assertEquals($before, Project::findOrFail($id)->getRawOriginal());
    }

    public function test_retrying_keyed_creation_returns_the_original_project_without_duplicate_phases(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'My Residence'])->assertOk();
        $retry = $this->plan();
        $retry['projectTitle'] = 'A stale generated title';
        $this->postJson('/api/projects', $retry)->assertOk()->assertJsonPath('id', $id)
            ->assertJsonPath('title', 'My Residence')->assertJsonPath('projectNamePending', false)->assertJsonCount(1, 'phases');
        $this->assertSame(1, $owner->projects()->count());
        $this->assertSame(1, Project::findOrFail($id)->phases->first()->tasks()->count());
        $other = $this->user();
        Sanctum::actingAs($other);
        $otherId = $this->postJson('/api/projects', $this->plan())->assertCreated()->json('id');
        $this->assertNotSame($id, $otherId);
    }

    public function test_a_failed_finalization_rolls_back_partial_creation_and_retries_once(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $failed = false;
        ProjectPhaseTask::creating(function () use (&$failed) {
            if (! $failed) {
                $failed = true;
                throw new \RuntimeException('Simulated task storage failure');
            }
        });
        $this->postJson('/api/projects', $this->plan())->assertStatus(500);
        $this->assertSame(0, $owner->projects()->count());
        $id = $this->postJson('/api/projects', $this->plan())->assertCreated()->json('id');
        $this->postJson('/api/projects', $this->plan())->assertOk()->assertJsonPath('id', $id);
        $this->assertSame(1, $owner->projects()->count());
        $this->assertSame(1, Project::findOrFail($id)->phases->first()->tasks()->count());
    }

    public function test_retrying_placeholder_finalization_cannot_duplicate_or_reset_its_work(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        $id = $this->postJson('/api/projects/draft')->assertCreated()->json('id');
        $this->postJson("/api/projects/{$id}/plan", $this->plan())->assertOk()->assertJsonPath('projectNamePending', true);
        $this->postJson("/api/projects/{$id}/plan", $this->plan())->assertOk()->assertJsonCount(1, 'phases');
        $this->postJson("/api/projects/{$id}/plan", $this->plan('another-conversation-key'))->assertUnprocessable();
        $project = Project::findOrFail($id);
        $project->phases->first()->tasks()->update(['is_done' => true]);
        app(ProjectCompletionService::class)->submit($project->fresh(), $owner);
        $this->postJson("/api/projects/{$id}/plan", $this->plan())->assertOk()->assertJsonPath('status', 'completed');
        $this->assertSame(1, $owner->projects()->count());
        $this->assertTrue(Project::findOrFail($id)->phases->first()->tasks->first()->is_done);
    }

    public function test_the_saved_name_reaches_assigned_team_suppliers_and_history_only_after_official_completion(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'Shared Residence'])->assertOk();
        $this->getJson('/api/project-history')->assertOk()->assertExactJson([]);
        $project = Project::findOrFail($id);
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $supplier = $this->user('supplier');
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);
        $request = MaterialRequest::create(['project_id' => $id, 'homeowner_id' => $owner->id, 'contractor_id' => $contractor->id, 'status' => MaterialRequest::APPROVED]);
        $request->orders()->create(['supplier_id' => $supplier->id, 'status' => SupplierFulfillment::SUPPLIER_REVIEW]);
        foreach ([$contractor, $worker] as $member) {
            Sanctum::actingAs($member);
            $this->getJson('/api/my-projects')->assertOk()->assertJsonPath('0.title', 'Shared Residence');
        }
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-fulfillments')->assertOk()->assertJsonPath('0.project.title', 'Shared Residence');
        Sanctum::actingAs($this->user('supplier'));
        $this->getJson('/api/supplier-fulfillments')->assertOk()->assertExactJson([]);
        $project->phases->first()->tasks()->update(['is_done' => true]);
        app(ProjectCompletionService::class)->submit($project->fresh(), $contractor);
        Sanctum::actingAs($owner);
        $this->getJson('/api/project-history')->assertOk()->assertExactJson([]);
        app(ProjectCompletionService::class)->confirm($project->fresh(), $owner);
        $this->getJson('/api/project-history')->assertOk()->assertJsonPath('0.title', 'Shared Residence');
        $this->getJson("/api/project-history/{$id}")->assertOk()->assertJsonPath('project.approvedPlan.projectTitle', 'Shared Residence');
    }

    public function test_a_failed_database_save_keeps_the_pending_step_and_original_title(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        Project::updating(function () {
            throw new \RuntimeException('Simulated storage failure');
        });
        $this->patchJson("/api/projects/{$id}/name", ['name' => 'Not saved'])->assertStatus(500);
        $project = Project::findOrFail($id);
        $this->assertSame('AI generated house', $project->title);
        $this->assertTrue($project->projectNamePending());
    }

    public function test_legacy_projects_keep_their_titles_without_a_new_pending_naming_step(): void
    {
        $owner = $this->user();
        $id = $this->finalize($owner);
        $project = Project::findOrFail($id);
        $plan = $project->approved_plan;
        unset($plan['_projectNamePending'], $plan['_finalizationKey']);
        $project->update(['approved_plan' => $plan]);
        $this->getJson("/api/dashboard?project_id={$id}")->assertOk()->assertJsonPath('project.projectNamePending', null);
        $this->assertSame('AI generated house', $project->fresh()->title);
    }
}
