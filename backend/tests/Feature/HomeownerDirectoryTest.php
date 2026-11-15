<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeownerDirectoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_homeowner_without_projects_can_browse_only_approved_profiled_people_and_read_profiles(): void
    {
        $owner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        $people = [];
        foreach (['worker', 'contractor'] as $role) {
            foreach (['approved', 'pending', 'rejected'] as $status) {
                $person = User::factory()->create(['role' => $role, 'approval_status' => $status]);
                if ($role === 'worker') {
                    $person->workerProfile()->create(['trade' => 'Mason', 'years_experience' => 3, 'min_daily_wage' => 700])->skills()->create(['skill' => 'Masonry']);
                } else {
                    $person->contractorProfile()->create(['specialization' => 'Residential', 'years_experience' => 5])->skills()->create(['skill' => 'Renovation']);
                }
                if ($status === 'approved') {
                    $people[$role] = $person;
                }
            }
            User::factory()->create(['role' => $role, 'approval_status' => 'approved']); // No completed directory profile.
        }
        Sanctum::actingAs($owner);
        foreach (['worker' => 'workers', 'contractor' => 'contractors'] as $role => $endpoint) {
            $this->getJson("/api/{$endpoint}")->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $people[$role]->id);
            $this->getJson("/api/{$endpoint}/{$people[$role]->id}")->assertOk()->assertJsonPath('id', $people[$role]->id)
                ->assertJsonPath('averageRating', null)->assertJsonPath('ratingCount', 0)->assertJsonCount(1, 'skills')
                ->assertJsonMissingPath('email')->assertJsonMissingPath('profile_photo_path');
        }
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_workers', 0);
        $this->assertDatabaseCount('project_contractors', 0);
    }

    public function test_browsing_does_not_bypass_the_existing_project_invitation_requirements(): void
    {
        $owner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        $worker = User::factory()->create(['role' => 'worker', 'approval_status' => 'approved']);
        $contractor = User::factory()->create(['role' => 'contractor', 'approval_status' => 'approved']);
        $draft = Project::create(['user_id' => $owner->id, 'title' => 'Unfinished planning', 'status' => 'not_started',
            'budget' => 0, 'total_estimate' => 0, 'timeline_value' => 1, 'timeline_unit' => 'months', 'started_at' => '2026-11-14']);
        Sanctum::actingAs($owner);
        foreach (['worker' => $worker, 'contractor' => $contractor] as $role => $person) {
            $this->postJson("/api/projects/999999/{$role}s", ["{$role}_id" => $person->id])->assertNotFound();
            $this->postJson("/api/projects/{$draft->id}/{$role}s", ["{$role}_id" => $person->id])->assertUnprocessable();
        }
        $this->assertDatabaseCount('project_worker_requests', 0);
        $this->assertDatabaseCount('project_contractor_requests', 0);
        $this->assertDatabaseCount('project_workers', 0);
        $this->assertDatabaseCount('project_contractors', 0);
    }
}
