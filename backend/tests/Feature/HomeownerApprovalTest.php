<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeownerApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Validator::extend('indisposable', fn () => true);
    }

    private function account(string $role, string $status): User
    {
        return User::factory()->create([
            'role' => $role, 'approval_status' => $status, 'password' => 'password123',
        ]);
    }

    private function credentials(User $user): array
    {
        return ['email' => $user->email, 'password' => 'password123'];
    }

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => 'superadmin', 'email' => config('services.admin.email'), 'approval_status' => 'approved',
        ]));
    }

    public function test_homeowner_registration_grants_access_without_claiming_email_verification(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New Homeowner', 'email' => 'new-homeowner@gmail.com',
            'password' => 'password123', 'password_confirmation' => 'password123', 'role' => 'homeowner',
            'approval_status' => 'pending',
        ])->assertCreated()->assertJsonPath('user.approval_status', 'approved')
            ->assertJsonStructure(['user', 'token'])->assertJsonMissingPath('user.password');

        $user = User::findOrFail($response->json('user.id'));
        $this->assertNull($user->email_verified_at);
        $this->assertTrue(Hash::check('password123', $user->password));
        $this->getJson('/api/auth/me', ['Authorization' => 'Bearer '.$response->json('token')])
            ->assertOk()->assertJsonPath('id', $user->id);
        $this->postJson('/api/auth/login', $this->credentials($user))->assertOk()
            ->assertJsonPath('user.approval_status', 'approved')->assertJsonStructure(['token']);
    }

    public function test_professional_registrations_still_wait_for_admin_even_if_status_is_forged(): void
    {
        foreach (['contractor', 'worker', 'supplier'] as $role) {
            $response = $this->postJson('/api/auth/register', [
                'name' => 'Professional Account', 'email' => "new-{$role}@gmail.com",
                'password' => 'password123', 'password_confirmation' => 'password123', 'role' => $role,
                'business_name' => 'Recorded business', 'license_number' => 'LICENSE-1234',
                'approval_status' => 'approved',
            ])->assertCreated()->assertJsonPath('user.approval_status', 'pending')->assertJsonMissingPath('token');
            $user = User::findOrFail($response->json('user.id'));
            $this->postJson('/api/auth/login', $this->credentials($user))->assertForbidden()
                ->assertJsonPath('approval_status', 'pending')->assertJsonMissingPath('token');
            $this->postJson('/api/auth/approval-status', $this->credentials($user))
                ->assertOk()->assertJsonPath('approval_status', 'pending');
            $this->assertSame('pending', $user->fresh()->approval_status);
        }
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_legacy_pending_homeowner_is_upgraded_only_with_correct_credentials(): void
    {
        $user = $this->account('homeowner', 'pending');
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertUnauthorized()->assertJsonMissingPath('token');
        $this->assertSame('pending', $user->fresh()->approval_status);
        $this->postJson('/api/auth/login', $this->credentials($user))->assertOk()
            ->assertJsonPath('user.approval_status', 'approved')->assertJsonStructure(['token']);
        $this->assertSame('approved', $user->fresh()->approval_status);
    }

    public function test_existing_waiting_screen_observes_homeowner_eligibility_without_issuing_a_token(): void
    {
        $user = $this->account('homeowner', 'pending');
        $this->postJson('/api/auth/approval-status', $this->credentials($user))->assertOk()
            ->assertJsonPath('approval_status', 'approved')->assertJsonMissingPath('token');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_rejected_disabled_and_banned_homeowners_are_not_reactivated(): void
    {
        // The current admin UI revokes access using rejected; other restriction values also stay blocked.
        foreach (['rejected', 'disabled', 'banned', 'suspended'] as $status) {
            $user = $this->account('homeowner', $status);
            $this->postJson('/api/auth/login', $this->credentials($user))->assertForbidden()
                ->assertJsonPath('approval_status', $status)->assertJsonMissingPath('token');
            $this->postJson('/api/auth/approval-status', $this->credentials($user))->assertOk()
                ->assertJsonPath('approval_status', $status);
            $this->assertSame($status, $user->fresh()->approval_status);
        }
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_concurrent_admin_revocation_cannot_be_overwritten_by_legacy_upgrade(): void
    {
        $user = $this->account('homeowner', 'pending');
        Hash::partialMock()->shouldReceive('check')->once()->andReturnUsing(function () use ($user) {
            // Simulate an admin decision after the user was read but before upgrade's conditional write.
            $user->update(['approval_status' => 'rejected']);

            return true;
        });
        $this->postJson('/api/auth/login', $this->credentials($user))->assertForbidden()
            ->assertJsonPath('approval_status', 'rejected')->assertJsonMissingPath('token');
        $this->assertSame('rejected', $user->fresh()->approval_status);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_admin_pending_queue_and_counts_exclude_homeowners_but_all_accounts_remain_manageable(): void
    {
        $legacy = $this->account('homeowner', 'pending');
        $approved = $this->account('homeowner', 'approved');
        $rejected = $this->account('homeowner', 'rejected');
        foreach (['contractor', 'worker', 'supplier'] as $role) {
            $this->account($role, 'pending');
        }
        $this->admin();
        $response = $this->getJson('/api/admin/users?status=pending')->assertOk()->assertJsonCount(3);
        $this->assertSame(['contractor', 'supplier', 'worker'], collect($response->json())->pluck('role')->sort()->values()->all());
        $this->getJson('/api/admin/users?status=pending&role=homeowner')->assertOk()->assertJsonCount(0);
        $all = $this->getJson('/api/admin/users?role=homeowner')->assertOk()->assertJsonCount(3);
        $this->assertSame('approved', collect($all->json())->firstWhere('id', $legacy->id)['approval_status']);
        $this->assertSame('rejected', collect($all->json())->firstWhere('id', $rejected->id)['approval_status']);
        $this->getJson('/api/admin/users?status=approved&role=homeowner')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/admin/stats')->assertOk()->assertJsonPath('totals.pending', 3)
            ->assertJsonPath('totals.approved', 2)->assertJsonPath('totals.rejected', 1)->assertJsonPath('totals.users', 6);
        // Admin reads do not silently alter historical rows or remove users.
        $this->assertSame('pending', $legacy->fresh()->approval_status);
        $this->assertSame('approved', $approved->fresh()->approval_status);
    }

    public function test_homeowner_revocation_and_explicit_restoration_remain_available(): void
    {
        $homeowner = $this->account('homeowner', 'approved');
        $homeowner->createToken('existing-device');
        $this->admin();
        $this->patchJson("/api/admin/users/{$homeowner->id}/approval", ['status' => 'pending'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->assertSame('approved', $homeowner->fresh()->approval_status);
        $this->patchJson("/api/admin/users/{$homeowner->id}/approval", ['status' => 'rejected'])
            ->assertOk()->assertJsonPath('approval_status', 'rejected');
        $this->assertSame(0, $homeowner->tokens()->count());
        $this->postJson('/api/auth/login', $this->credentials($homeowner))->assertForbidden();
        $this->patchJson("/api/admin/users/{$homeowner->id}/approval", ['status' => 'approved'])->assertOk();
        $this->postJson('/api/auth/login', $this->credentials($homeowner))->assertOk()->assertJsonStructure(['token']);
    }

    public function test_admin_approval_still_unlocks_each_professional_role(): void
    {
        $this->admin();
        foreach (['contractor', 'worker', 'supplier'] as $role) {
            $user = $this->account($role, 'pending');
            $this->patchJson("/api/admin/users/{$user->id}/approval", ['status' => 'approved'])->assertOk();
            $this->postJson('/api/auth/login', $this->credentials($user))->assertOk()->assertJsonStructure(['token']);
        }
    }
}
