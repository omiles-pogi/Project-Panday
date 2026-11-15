<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeownerProfilePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function person(string $role): User
    {
        $person = User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
        if ($role === 'worker') {
            $person->workerProfile()->create(['trade' => 'Mason', 'years_experience' => 3]);
        } elseif ($role === 'contractor') {
            $person->contractorProfile()->create(['specialization' => 'Residential', 'years_experience' => 5]);
        }

        return $person;
    }

    private function upload(User $person, string $name = 'portrait.jpg'): string
    {
        Sanctum::actingAs($person);

        return $this->postJson('/api/account/photo', ['photo' => UploadedFile::fake()->image($name, 100, 100)])
            ->assertOk()->json('photoUrl');
    }

    private function project(User $owner): Project
    {
        return Project::create(['user_id' => $owner->id, 'title' => 'Photo visibility test', 'status' => 'active',
            'budget' => 1000000, 'total_estimate' => 900000, 'timeline_value' => 6, 'timeline_unit' => 'months', 'started_at' => '2026-11-01', 'approved_plan' => []]);
    }

    public function test_existing_worker_and_contractor_portraits_reach_directory_profiles_and_current_team(): void
    {
        $owner = $this->person('homeowner');
        $project = $this->project($owner);
        $urls = [];
        foreach (['worker' => 'workers', 'contractor' => 'contractors'] as $role => $endpoint) {
            $person = $this->person($role);
            $url = $this->upload($person);
            $project->{$endpoint}()->attach($person);
            $original = $person->fresh()->getRawOriginal();
            Sanctum::actingAs($owner);
            $this->getJson("/api/{$endpoint}")->assertOk()->assertJsonPath('0.photoUrl', $url)
                ->assertJsonMissingPath('0.profile_photo_path')->assertJsonMissingPath('0.password');
            $this->getJson("/api/{$endpoint}/{$person->id}")->assertOk()->assertJsonPath('photoUrl', $url)
                ->assertJsonMissingPath('profile_photo_path')->assertJsonMissingPath('email');
            $this->get($url)->assertOk()->assertHeader('content-type', 'image/jpeg')->assertHeader('X-Content-Type-Options', 'nosniff');
            $this->assertSame($original, $person->fresh()->getRawOriginal());
            $urls[$role] = $url;
        }
        $originalProject = $project->fresh()->getRawOriginal();
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()
            ->assertJsonPath('team.0.photoUrl', $urls['worker'])->assertJsonPath('team.1.photoUrl', $urls['contractor'])
            ->assertJsonMissingPath('team.0.profile_photo_path')->assertJsonMissingPath('team.1.email');
        $this->assertSame($originalProject, $project->fresh()->getRawOriginal());
        $this->assertDatabaseCount('project_workers', 1);
        $this->assertDatabaseCount('project_contractors', 1);
    }

    public function test_homeowner_browsing_does_not_require_a_project_and_private_roles_stay_private(): void
    {
        $worker = $this->person('worker');
        $workerUrl = $this->upload($worker);
        $private = $this->person('supplier');
        $privateUrl = $this->upload($private);
        foreach (['supplier', 'worker', 'contractor'] as $role) {
            Sanctum::actingAs($this->person($role));
            $this->get($workerUrl)->assertForbidden();
        }
        Sanctum::actingAs($this->person('homeowner'));
        $this->get($workerUrl)->assertOk();
        $this->get($privateUrl)->assertForbidden();
        $this->assertDatabaseCount('projects', 0);
    }

    public function test_ineligible_people_missing_images_and_retired_versions_do_not_expose_uploads(): void
    {
        $owner = $this->person('homeowner');
        $worker = $this->person('worker');
        $old = $this->upload($worker);
        $new = $this->upload($worker, 'replacement.png');
        Sanctum::actingAs($owner);
        $this->get($old)->assertNotFound();
        $this->get($new)->assertOk()->assertHeader('content-type', 'image/png');
        $this->getJson("/api/workers/{$worker->id}")->assertJsonPath('photoUrl', $new);
        foreach (['pending', 'rejected'] as $status) {
            $worker->update(['approval_status' => $status]);
            $this->get($new)->assertForbidden();
            $this->getJson("/api/workers/{$worker->id}")->assertJsonPath('photoUrl', null);
        }
        $worker->update(['approval_status' => 'approved']);
        $worker->workerProfile()->delete();
        $this->get($new)->assertForbidden();
    }

    public function test_application_portraits_are_resolved_live_without_rewriting_notification_data(): void
    {
        $owner = $this->person('homeowner');
        $project = $this->project($owner);
        foreach (['worker', 'contractor'] as $role) {
            $person = $this->person($role);
            $old = $this->upload($person);
            $relation = $role === 'worker' ? 'workerRequests' : 'contractorRequests';
            $request = $project->{$relation}()->create([$role.'_id' => $person->id, 'initiated_by' => $role, 'status' => 'pending']);
            $notification = AppNotification::create(['user_id' => $owner->id, 'type' => $role.'_application', 'title' => 'Application', 'body' => 'Saved application',
                'data' => ['projectId' => $project->id, 'requestId' => $request->id, $role.'Id' => $person->id]]);
            $original = $notification->fresh()->getRawOriginal();
            Sanctum::actingAs($owner);
            $this->getJson('/api/notifications')->assertOk()->assertJsonFragment(['applicantPhotoUrl' => $old]);
            $new = $this->upload($person, 'new.png');
            Sanctum::actingAs($owner);
            $this->getJson('/api/notifications')->assertOk()->assertJsonFragment(['applicantPhotoUrl' => $new]);
            $this->assertSame($original, $notification->fresh()->getRawOriginal());
            $this->assertSame('pending', $request->fresh()->status);
        }
        $this->assertDatabaseCount('project_workers', 0);
        $this->assertDatabaseCount('project_contractors', 0);
    }

    public function test_unauthenticated_photo_reads_are_rejected(): void
    {
        $this->getJson('/api/account/photo/123/portrait.jpg')->assertUnauthorized();
    }

    public function test_missing_images_and_empty_photo_paths_allow_frontend_fallback_without_a_reupload(): void
    {
        $owner = $this->person('homeowner');
        $worker = $this->person('worker');
        Sanctum::actingAs($owner);
        $this->getJson("/api/workers/{$worker->id}")->assertOk()->assertJsonPath('photoUrl', null);
        $worker->forceFill(['profile_photo_path' => 'profile-photos/missing.jpg'])->save();
        $this->get($worker->fresh()->profile_photo_url)->assertNotFound();
        $this->assertSame('profile-photos/missing.jpg', $worker->fresh()->profile_photo_path);
    }
}
