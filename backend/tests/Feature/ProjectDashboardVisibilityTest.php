<?php

namespace Tests\Feature;

use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\SupplierFulfillment;
use App\Models\User;
use App\Services\ProjectCompletionService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectDashboardVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner, string $title = 'Saved residence'): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => $title, 'location' => 'Dagupan', 'budget' => 900000, 'totalEstimate' => 850000,
            'timelineValue' => 6, 'timelineUnit' => 'months', 'areaSqm' => 100, 'floors' => 1,
            'phases' => [['name' => 'Build', 'percentComplete' => 100, 'tasks' => ['Final inspection']]],
        ]);
    }

    private function complete(Project $project, User $actor, User $owner): void
    {
        foreach ($project->phases as $phase) {
            $phase->tasks()->update(['is_done' => true]);
            $phase->update(['progress_pct' => 100]);
        }
        app(ProjectCompletionService::class)->submit($project->fresh(), $actor);
        if ($project->fresh()->status === Project::PENDING_CONFIRMATION) {
            app(ProjectCompletionService::class)->confirm($project->fresh(), $owner);
        }
        $this->assertSame('completed', $project->fresh()->status);
    }

    private function hideUrl(Project $project): string
    {
        return "/api/projects/{$project->id}/hide-from-dashboard";
    }

    public function test_completed_projects_are_visible_by_default_and_hide_only_from_home_queries(): void
    {
        $owner = $this->user();
        $active = $this->project($owner, 'Active residence');
        $first = $this->project($owner, 'First completed residence');
        $removed = $this->project($owner, 'Named completed residence');
        $this->complete($first, $owner, $owner);
        $this->complete($removed, $owner, $owner);
        Sanctum::actingAs($owner);
        $this->assertFalse($removed->fresh()->is_hidden_from_dashboard);
        $this->getJson('/api/projects?dashboard_only=1')->assertOk()->assertJsonCount(3);
        $this->getJson('/api/dashboard?dashboard_only=1')->assertOk()->assertJsonPath('project.id', $removed->id);

        $this->patchJson($this->hideUrl($removed), ['status' => 'active'])->assertOk()
            ->assertJsonPath('id', $removed->id)->assertJsonPath('status', 'completed')->assertJsonPath('isHiddenFromDashboard', true);
        $this->getJson('/api/projects?dashboard_only=1')->assertOk()->assertJsonCount(2)
            ->assertJsonMissing(['id' => $removed->id]);
        $this->getJson('/api/dashboard?dashboard_only=1')->assertOk()->assertJsonPath('project.id', $first->id)
            ->assertJsonPath('stats.completed', 2);
        $this->getJson("/api/dashboard?dashboard_only=1&project_id={$removed->id}")->assertOk()->assertJsonPath('project.id', $first->id);
        // Existing AI/general project consumers do not opt into the Home preference.
        $this->getJson('/api/projects')->assertOk()->assertJsonCount(3);
        $this->getJson("/api/dashboard?project_id={$removed->id}")->assertOk()->assertJsonPath('project.id', $removed->id);
        $this->getJson('/api/project-history')->assertOk()->assertJsonCount(2)->assertJsonFragment(['title' => 'Named completed residence']);
        $this->assertDatabaseHas('projects', ['id' => $active->id, 'status' => 'active', 'is_hidden_from_dashboard' => false]);
    }

    public function test_history_and_all_related_records_and_other_accounts_access_are_preserved(): void
    {
        $owner = $this->user();
        $project = $this->project($owner, 'Preserved residence');
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $supplier = $this->user('supplier');
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);
        $this->complete($project, $contractor, $owner);
        $product = $supplier->supplierProducts()->create(['name' => 'Cement', 'unit' => 'bag', 'category' => 'Cement', 'price' => 300, 'stock' => 100]);
        $request = MaterialRequest::create(['project_id' => $project->id, 'homeowner_id' => $owner->id, 'contractor_id' => $contractor->id, 'status' => MaterialRequest::COMPLETED]);
        $order = $request->orders()->create(['supplier_id' => $supplier->id, 'status' => SupplierFulfillment::RECEIVED]);
        $request->items()->create([
            'supplier_order_id' => $order->id, 'supplier_product_id' => $product->id, 'supplier_id' => $supplier->id,
            'material_name' => 'Recorded cement', 'unit' => 'bag', 'quantity' => 10, 'estimated_unit_price' => 265,
            'confirmed_unit_price' => 280, 'status' => 'confirmed',
        ]);
        $tables = ['project_phases', 'project_phase_tasks', 'project_workers', 'project_contractors', 'material_requests', 'material_request_items', 'supplier_fulfillments', 'supplier_products'];
        $before = [];
        foreach ($tables as $table) {
            $before[$table] = DB::table($table)->get()->toJson();
        }
        $projectBefore = $project->fresh()->getRawOriginal();
        Sanctum::actingAs($owner);
        $historyBefore = $this->getJson("/api/project-history/{$project->id}")->assertOk()->json();
        $this->patchJson($this->hideUrl($project))->assertOk();
        $this->getJson("/api/project-history/{$project->id}")->assertOk()->assertExactJson($historyBefore);
        $after = $project->fresh()->getRawOriginal();
        unset($projectBefore['is_hidden_from_dashboard'], $projectBefore['updated_at'], $after['is_hidden_from_dashboard'], $after['updated_at']);
        $this->assertSame($projectBefore, $after);
        foreach ($tables as $table) {
            $this->assertSame($before[$table], DB::table($table)->get()->toJson(), $table);
        }
        foreach ([$contractor, $worker] as $member) {
            Sanctum::actingAs($member);
            $this->getJson('/api/my-projects')->assertOk()->assertJsonPath('0.id', $project->id)->assertJsonPath('0.title', 'Preserved residence');
        }
        Sanctum::actingAs($supplier);
        $this->getJson('/api/supplier-fulfillments')->assertOk()->assertJsonPath('0.project.id', $project->id)
            ->assertJsonPath('0.items.0.confirmedUnitPrice', 280);
        $this->assertSame(1, $owner->projects()->count());
    }

    public function test_hidden_preferences_survive_a_new_session_and_all_hidden_home_is_empty(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $this->complete($project, $owner, $owner);
        Sanctum::actingAs($owner);
        $this->patchJson($this->hideUrl($project))->assertOk();
        Sanctum::actingAs($this->user());
        $this->getJson('/api/projects?dashboard_only=1')->assertOk()->assertExactJson([]);
        Sanctum::actingAs($owner->fresh());
        $this->getJson('/api/projects?dashboard_only=1')->assertOk()->assertExactJson([]);
        $this->getJson("/api/dashboard?dashboard_only=1&project_id={$project->id}")->assertOk()->assertJsonPath('project', null)
            ->assertJsonPath('stats.completed', 1);
        $this->getJson('/api/project-history')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $project->id);
    }

    public function test_active_drafts_and_pending_confirmation_cannot_be_removed(): void
    {
        $owner = $this->user();
        Sanctum::actingAs($owner);
        foreach (['active', 'not_started', Project::PENDING_CONFIRMATION] as $status) {
            $project = $this->project($owner);
            $project->update(['status' => $status, 'started_at' => '2020-01-01']);
            $this->patchJson($this->hideUrl($project))->assertUnprocessable()->assertJsonValidationErrors('project_id');
            $this->assertFalse($project->fresh()->is_hidden_from_dashboard);
            $this->assertSame($status, $project->fresh()->status);
        }
    }

    public function test_only_the_owning_homeowner_can_remove_a_completed_project(): void
    {
        $this->patchJson('/api/projects/1/hide-from-dashboard')->assertUnauthorized();
        $owner = $this->user();
        $project = $this->project($owner);
        $this->complete($project, $owner, $owner);
        Sanctum::actingAs($this->user());
        $this->patchJson($this->hideUrl($project))->assertNotFound();
        foreach (array_diff(User::ROLES, ['homeowner']) as $role) {
            Sanctum::actingAs($this->user($role));
            $this->patchJson($this->hideUrl($project))->assertForbidden();
        }
        Sanctum::actingAs($owner);
        $this->patchJson('/api/projects/999999/hide-from-dashboard')->assertNotFound();
        $this->assertFalse($project->fresh()->is_hidden_from_dashboard);
    }

    public function test_repeated_removal_is_idempotent_and_failed_saves_do_not_hide_anything(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $other = $this->project($owner);
        $this->complete($project, $owner, $owner);
        $this->complete($other, $owner, $owner);
        Sanctum::actingAs($owner);
        $this->patchJson($this->hideUrl($project))->assertOk();
        $before = $project->fresh()->getRawOriginal();
        $this->patchJson($this->hideUrl($project))->assertOk();
        $this->assertSame($before, $project->fresh()->getRawOriginal());
        Project::updating(function () {
            throw new \RuntimeException('Simulated visibility storage failure');
        });
        $this->patchJson($this->hideUrl($other))->assertStatus(500);
        $this->assertFalse($other->fresh()->is_hidden_from_dashboard);
        $this->assertSame('completed', $other->fresh()->status);
    }

    public function test_deployment_before_migration_keeps_home_reads_available_and_refuses_a_false_success(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $this->complete($project, $owner, $owner);
        Sanctum::actingAs($owner);
        Schema::partialMock()->shouldReceive('hasColumn')->with('projects', 'is_hidden_from_dashboard')->andReturn(false);
        $this->getJson('/api/projects?dashboard_only=1')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/dashboard?dashboard_only=1')->assertOk()->assertJsonPath('project.id', $project->id);
        $this->patchJson($this->hideUrl($project))->assertStatus(503);
        $this->assertFalse($project->fresh()->is_hidden_from_dashboard);
    }
}
