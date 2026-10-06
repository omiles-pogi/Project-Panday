<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminProjectsTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $admin = User::factory()->create([
            'role' => 'superadmin',
            'email' => config('services.admin.email'),
            'approval_status' => 'approved',
        ]);

        return $admin->createToken('admin')->plainTextToken;
    }

    /**
     * Creates a project directly via the service — this is fixture setup for the
     * admin-listing tests below, not itself under test, so it avoids going through an
     * authenticated HTTP call (mixing two different Bearer-token identities in one test
     * method trips Sanctum's RequestGuard, which memoizes the first resolved user).
     */
    private function createProjectFor(User $homeowner, string $title): void
    {
        app(ProjectService::class)->createFromPlan($homeowner, [
            'projectTitle' => $title,
            'location' => 'Quezon City',
            'budget' => 1000000,
            'totalEstimate' => 950000,
            'timelineMonths' => 6,
            'phases' => [
                ['name' => 'Foundation', 'percentComplete' => 50],
                ['name' => 'Finishing', 'percentComplete' => 50],
            ],
        ]);
    }

    public function test_admin_can_list_all_homeowner_projects(): void
    {
        $homeowner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        $this->createProjectFor($homeowner, 'My House');

        $response = $this->getJson('/api/admin/projects', [
            'Authorization' => "Bearer {$this->adminToken()}",
        ]);

        $response->assertStatus(200)->assertJsonCount(1);
        $response->assertJsonPath('0.title', 'My House');
        $response->assertJsonPath('0.owner.email', $homeowner->email);
        $response->assertJsonPath('0.overallProgressPct', 0);
    }

    public function test_admin_projects_requires_authentication(): void
    {
        $this->getJson('/api/admin/projects')->assertStatus(401);
    }

    public function test_a_non_admin_cannot_list_projects(): void
    {
        $homeowner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        $token = $homeowner->createToken('mobile')->plainTextToken;

        $this->getJson('/api/admin/projects', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(403);
    }

    public function test_stats_includes_project_totals(): void
    {
        $homeowner = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
        $this->createProjectFor($homeowner, 'My House');

        $response = $this->getJson('/api/admin/stats', [
            'Authorization' => "Bearer {$this->adminToken()}",
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('projects.total', 1)
            ->assertJsonPath('projects.active', 1)
            ->assertJsonPath('projects.avg_progress', 0);
    }
}
