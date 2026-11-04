<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeownerProfileTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    private function homeowner(): User
    {
        return $this->user('homeowner', ['name' => 'Maria Santos', 'email' => 'maria@example.test']);
    }

    private function project(User $owner, string $status): void
    {
        $owner->projects()->create(['title' => "{$status} project", 'status' => $status, 'started_at' => now()->toDateString()]);
    }

    public function test_a_homeowner_with_no_profile_yet_sees_their_account_and_empty_details(): void
    {
        Sanctum::actingAs($this->homeowner());

        $this->getJson('/api/homeowner-profile')
            ->assertOk()
            ->assertJsonPath('name', 'Maria Santos')
            ->assertJsonPath('email', 'maria@example.test')
            ->assertJsonPath('location', null)
            ->assertJsonPath('contactNumber', null)
            ->assertJsonPath('projects', ['total' => 0, 'notStarted' => 0, 'active' => 0, 'completed' => 0]);
    }

    public function test_the_profile_counts_the_homeowners_projects_by_status(): void
    {
        $owner = $this->homeowner();
        foreach (['not_started', 'active', 'active', 'completed'] as $status) {
            $this->project($owner, $status);
        }
        // Someone else's project is never counted.
        $this->project($this->user('homeowner'), 'active');
        Sanctum::actingAs($owner);

        $this->getJson('/api/homeowner-profile')
            ->assertJsonPath('projects', ['total' => 4, 'notStarted' => 1, 'active' => 2, 'completed' => 1]);
    }

    public function test_a_homeowner_can_save_their_details(): void
    {
        $owner = $this->homeowner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/homeowner-profile', ['location' => 'Dagupan City, Pangasinan', 'contact_number' => '0912 345 6789'])
            ->assertOk()
            ->assertJsonPath('location', 'Dagupan City, Pangasinan')
            ->assertJsonPath('contactNumber', '0912 345 6789');

        $this->assertSame('Dagupan City, Pangasinan', $owner->fresh()->homeownerProfile->location);
        $this->getJson('/api/homeowner-profile')->assertJsonPath('contactNumber', '0912 345 6789');
    }

    public function test_saving_again_updates_the_same_profile_and_empty_fields_are_cleared(): void
    {
        Sanctum::actingAs($this->homeowner());
        $this->putJson('/api/homeowner-profile', ['location' => 'Dagupan', 'contact_number' => '09123456789'])->assertOk();

        $this->putJson('/api/homeowner-profile', ['location' => 'Lingayen', 'contact_number' => ''])
            ->assertOk()
            ->assertJsonPath('location', 'Lingayen')
            ->assertJsonPath('contactNumber', null);

        $this->assertDatabaseCount('homeowner_profiles', 1);
    }

    public function test_the_name_email_and_role_cannot_be_changed_from_the_profile(): void
    {
        $owner = $this->homeowner();
        Sanctum::actingAs($owner);

        $this->putJson('/api/homeowner-profile', [
            'location' => 'Dagupan', 'name' => 'Someone Else', 'email' => 'other@example.test', 'role' => 'admin',
        ])->assertOk()->assertJsonPath('name', 'Maria Santos')->assertJsonPath('email', 'maria@example.test');

        $fresh = $owner->fresh();
        $this->assertSame('Maria Santos', $fresh->name);
        $this->assertSame('maria@example.test', $fresh->email);
        $this->assertSame('homeowner', $fresh->role);
    }

    public function test_the_contact_number_must_look_like_a_phone_number(): void
    {
        Sanctum::actingAs($this->homeowner());

        $this->putJson('/api/homeowner-profile', ['contact_number' => 'call me maybe'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('contact_number');
        $this->putJson('/api/homeowner-profile', ['location' => str_repeat('x', 256)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('location');
    }

    public function test_only_homeowners_have_a_homeowner_profile(): void
    {
        foreach (['contractor', 'supplier', 'worker'] as $role) {
            Sanctum::actingAs($this->user($role));

            $this->getJson('/api/homeowner-profile')->assertForbidden();
            $this->putJson('/api/homeowner-profile', ['location' => 'Anywhere'])->assertForbidden();
        }
    }

    public function test_a_homeowner_only_ever_sees_and_edits_their_own_profile(): void
    {
        $mine = $this->homeowner();
        $theirs = $this->user('homeowner');
        $theirs->homeownerProfile()->create(['location' => 'Elsewhere', 'contact_number' => '09999999999']);
        Sanctum::actingAs($mine);

        $this->getJson('/api/homeowner-profile')->assertJsonPath('location', null)->assertJsonPath('contactNumber', null);
        $this->putJson('/api/homeowner-profile', ['location' => 'Dagupan'])->assertOk();

        $this->assertSame('Elsewhere', $theirs->fresh()->homeownerProfile->location);
    }

    public function test_the_details_are_not_exposed_to_the_team_through_the_project_list(): void
    {
        $owner = $this->homeowner();
        $owner->homeownerProfile()->create(['location' => 'Dagupan', 'contact_number' => '09123456789']);
        $this->project($owner, 'active');
        Sanctum::actingAs($this->user('contractor'));

        $response = $this->getJson('/api/projects/available');

        $this->assertStringNotContainsString('09123456789', $response->getContent());
    }
}
