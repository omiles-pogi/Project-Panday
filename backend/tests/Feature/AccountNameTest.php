<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountNameTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'approval_status' => 'approved'], $overrides));
    }

    public function test_every_kind_of_user_can_change_their_own_name(): void
    {
        foreach (['homeowner', 'contractor', 'supplier', 'worker'] as $role) {
            $user = $this->user($role, ['name' => 'Old Name']);
            Sanctum::actingAs($user);

            $this->patchJson('/api/auth/me', ['name' => 'Maria Santos'])
                ->assertOk()
                ->assertJsonPath('id', $user->id)
                ->assertJsonPath('name', 'Maria Santos')
                ->assertJsonPath('role', $role);

            $this->assertSame('Maria Santos', $user->fresh()->name);
            $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('name', 'Maria Santos');
        }
    }

    public function test_the_new_name_is_trimmed(): void
    {
        $user = $this->user('worker');
        Sanctum::actingAs($user);

        $this->patchJson('/api/auth/me', ['name' => '   Juan dela Cruz  '])->assertOk()->assertJsonPath('name', 'Juan dela Cruz');
    }

    public function test_a_name_has_to_be_real_text_of_a_sensible_length(): void
    {
        Sanctum::actingAs($this->user('homeowner', ['name' => 'Keep Me']));

        $this->patchJson('/api/auth/me', [])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->patchJson('/api/auth/me', ['name' => ''])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->patchJson('/api/auth/me', ['name' => '   '])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->patchJson('/api/auth/me', ['name' => 'A'])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->patchJson('/api/auth/me', ['name' => str_repeat('a', 256)])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->patchJson('/api/auth/me', ['name' => ['Maria']])->assertStatus(422)->assertJsonValidationErrors('name');

        $this->assertSame('Keep Me', auth()->user()->fresh()->name);
    }

    public function test_only_the_name_can_be_changed_not_the_email_role_or_verified_details(): void
    {
        $user = $this->user('supplier', ['name' => 'Old', 'email' => 'shop@example.com', 'business_name' => 'Tripple R', 'license_number' => 'LIC-12345']);
        Sanctum::actingAs($user);

        $this->patchJson('/api/auth/me', [
            'name' => 'New Name',
            'email' => 'hacker@example.com',
            'role' => 'superadmin',
            'approval_status' => 'rejected',
            'business_name' => 'Other Co',
            'license_number' => 'FAKE-0000',
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertSame('New Name', $fresh->name);
        $this->assertSame('shop@example.com', $fresh->email);
        $this->assertSame('supplier', $fresh->role);
        $this->assertSame('approved', $fresh->approval_status);
        $this->assertSame('Tripple R', $fresh->business_name);
        $this->assertSame('LIC-12345', $fresh->license_number);
    }

    public function test_renaming_yourself_never_touches_anyone_else(): void
    {
        $me = $this->user('homeowner', ['name' => 'Me']);
        $other = $this->user('homeowner', ['name' => 'Someone Else']);
        Sanctum::actingAs($me);

        $this->patchJson('/api/auth/me', ['name' => 'Renamed'])->assertOk();

        $this->assertSame('Someone Else', $other->fresh()->name);
    }

    public function test_you_have_to_be_signed_in(): void
    {
        $this->patchJson('/api/auth/me', ['name' => 'Maria Santos'])->assertUnauthorized();
    }

    public function test_the_profile_screens_show_the_new_name(): void
    {
        $homeowner = $this->user('homeowner', ['name' => 'Old Homeowner']);
        Sanctum::actingAs($homeowner);
        $this->patchJson('/api/auth/me', ['name' => 'New Homeowner'])->assertOk();
        $this->getJson('/api/homeowner-profile')->assertOk()->assertJsonPath('name', 'New Homeowner');

        $supplier = $this->user('supplier', ['name' => 'Old Supplier', 'business_name' => 'Acme']);
        Sanctum::actingAs($supplier);
        $this->patchJson('/api/auth/me', ['name' => 'New Supplier'])->assertOk();
        $this->getJson('/api/supplier-profile')->assertOk()->assertJsonPath('name', 'New Supplier')->assertJsonPath('businessName', 'Acme');
    }
}
