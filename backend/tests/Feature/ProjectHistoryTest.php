<?php

namespace Tests\Feature;

use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\SupplierFulfillment;
use App\Models\User;
use App\Services\ProjectCompletionService;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectHistoryTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function project(User $owner, string $title = 'Saved residence'): Project
    {
        return app(ProjectService::class)->createFromPlan($owner, [
            'projectTitle' => $title, 'location' => 'Dagupan', 'budget' => 900000,
            'totalEstimate' => 850000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'areaSqm' => 200, 'floors' => 2, 'bedrooms' => 3, 'bathrooms' => 2,
            'designStyle' => 'Modern', 'exteriorConcept' => 'Saved exterior', 'interiorConcept' => 'Saved interior',
            'phases' => [['name' => 'Construction', 'percentComplete' => 100, 'tasks' => ['Final inspection']]],
        ]);
    }

    /** Exercise the existing completion service, without changing the lifecycle for History. */
    private function finish(Project $project, User $owner, string $date): void
    {
        Carbon::setTestNow($date);
        foreach ($project->phases as $phase) {
            $phase->tasks()->update(['is_done' => true]);
            $phase->update(['progress_pct' => 100]);
        }
        app(ProjectCompletionService::class)->submit($project->fresh(), $owner);
        $this->assertSame('completed', $project->fresh()->status);
    }

    public function test_history_contains_only_owned_officially_completed_projects_in_confirmation_order(): void
    {
        $owner = $this->user();
        $newest = $this->project($owner, 'Newest confirmation');
        $older = $this->project($owner, 'Older confirmation');
        $this->finish($newest, $owner, '2026-06-10 10:00:00');
        $this->finish($older, $owner, '2026-02-10 10:00:00');
        $legacy = $this->project($owner, 'Legacy completion');
        $legacy->update(['status' => 'completed', 'completion_confirmed_at' => null]);
        $unfinished = $this->project($owner);
        $unfinished->update(['started_at' => '2020-01-01']);
        $unfinished->phases->each(fn ($phase) => $phase->update(['progress_pct' => 100]));
        $this->project($owner)->update(['status' => Project::PENDING_CONFIRMATION]);
        $this->project($owner)->update(['status' => 'not_started']);
        $other = $this->user();
        $this->finish($this->project($other), $other, '2026-07-10 10:00:00');
        Sanctum::actingAs($owner);

        $response = $this->getJson('/api/project-history')->assertOk()->assertJsonCount(3);
        $this->assertSame([$newest->id, $older->id, $legacy->id], $response->json('*.id'));
        $response->assertJsonPath('0.status', 'completed')->assertJsonPath('0.areaSqm', 200)
            ->assertJsonPath('0.floors', 2)->assertJsonPath('2.completedAt', null);
        $this->assertDatabaseHas('projects', ['id' => $unfinished->id, 'status' => 'active']);
    }

    public function test_guest_and_every_other_role_are_blocked_from_list_and_details(): void
    {
        $this->getJson('/api/project-history')->assertUnauthorized();
        $this->getJson('/api/project-history/1')->assertUnauthorized();
        foreach (array_diff(User::ROLES, ['homeowner']) as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/project-history')->assertForbidden();
            $this->getJson('/api/project-history/1')->assertForbidden();
        }
    }

    public function test_details_never_expose_another_owners_project_or_an_unfinished_project(): void
    {
        $owner = $this->user();
        $other = $this->user();
        $foreign = $this->project($other);
        $this->finish($foreign, $other, '2026-06-10');
        Sanctum::actingAs($owner);
        $this->getJson("/api/project-history/{$foreign->id}")->assertNotFound();
        foreach (['not_started', 'active', Project::PENDING_CONFIRMATION] as $status) {
            $unfinished = $this->project($owner);
            $unfinished->update(['status' => $status]);
            $this->getJson("/api/project-history/{$unfinished->id}")->assertNotFound();
        }
        $this->getJson('/api/project-history/999999')->assertNotFound();
        $this->getJson('/api/project-history/not-an-id')->assertNotFound();
    }

    public function test_empty_history_uses_no_samples_and_survives_switching_authenticated_sessions(): void
    {
        $owner = $this->user();
        $other = $this->user();
        Sanctum::actingAs($owner);
        $this->getJson('/api/project-history')->assertOk()->assertExactJson([]);
        $project = $this->project($owner);
        $this->finish($project, $owner, '2026-06-10');
        Sanctum::actingAs($other);
        $this->getJson('/api/project-history')->assertOk()->assertExactJson([]);
        Sanctum::actingAs($owner->fresh());
        $this->getJson('/api/project-history')->assertOk()->assertJsonPath('0.id', $project->id);
    }

    public function test_legacy_metadata_stays_unknown_and_titles_have_a_neutral_id_fallback(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $project->update(['status' => 'completed', 'title' => ' ', 'approved_plan' => null]);
        Sanctum::actingAs($owner);
        $this->getJson('/api/project-history')->assertOk()
            ->assertJsonPath('0.title', "Project #{$project->id}")
            ->assertJsonPath('0.floors', null)->assertJsonPath('0.areaSqm', null)
            ->assertJsonPath('0.designStyle', null)->assertJsonPath('0.completedAt', null);
        $this->getJson("/api/project-history/{$project->id}")->assertOk()->assertJsonPath('project.approvedPlan', null);
    }

    public function test_details_reuse_real_plan_team_phases_and_material_snapshot_costs_without_writing(): void
    {
        $owner = $this->user();
        $project = $this->project($owner);
        $project->update(['started_at' => '2026-01-01']);
        $this->finish($project, $owner, '2026-06-10 10:00:00');
        $contractor = $this->user('contractor');
        $worker = $this->user('worker');
        $project->contractors()->attach($contractor->id);
        $project->workers()->attach($worker->id);
        $supplier = $this->user('supplier');
        $product = $supplier->supplierProducts()->create([
            'name' => 'Cement', 'unit' => 'bag', 'category' => 'Cement', 'price' => 999, 'stock' => 100,
        ]);
        $request = MaterialRequest::create([
            'project_id' => $project->id, 'contractor_id' => $contractor->id,
            'homeowner_id' => $owner->id, 'status' => MaterialRequest::COMPLETED,
        ]);
        $fulfillment = $request->orders()->create(['supplier_id' => $supplier->id, 'status' => SupplierFulfillment::RECEIVED]);
        $request->items()->create([
            'supplier_order_id' => $fulfillment->id, 'supplier_product_id' => $product->id,
            'supplier_id' => $supplier->id, 'material_name' => 'Historical cement', 'unit' => 'bag',
            'quantity' => 10, 'estimated_unit_price' => 265, 'confirmed_unit_price' => 280, 'status' => 'confirmed',
        ]);
        $before = DB::table('projects')->where('id', $project->id)->first();
        Sanctum::actingAs($owner);

        $this->getJson("/api/project-history/{$project->id}")->assertOk()
            ->assertJsonPath('title', 'Saved residence')->assertJsonPath('plannedEndAt', '2026-06-30')
            ->assertJsonPath('project.location', 'Dagupan')->assertJsonPath('project.budget', 900000)
            ->assertJsonPath('project.approvedPlan.exteriorConcept', 'Saved exterior')
            ->assertJsonPath('project.contractors.0.id', $contractor->id)->assertJsonPath('project.workers.0.id', $worker->id)
            ->assertJsonPath('project.phases.0.tasks.0.isDone', true)
            ->assertJsonPath('project.budgetRecords.fulfillmentLines.0.material', 'Historical cement')
            ->assertJsonPath('project.budgetRecords.fulfillmentLines.0.unitPrice', 280)
            ->assertJsonPath('project.budgetRecords.confirmedMaterialTotal', 2800)
            ->assertJsonPath('project.budgetRecords.paidTotal', null);
        $this->assertEquals($before, DB::table('projects')->where('id', $project->id)->first());
        $this->postJson("/api/project-history/{$project->id}")->assertStatus(405);
        $this->deleteJson("/api/project-history/{$project->id}")->assertStatus(405);
    }
}
