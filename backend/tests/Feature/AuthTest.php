<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_user_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'homeowner',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', 'test@example.com')
            ->assertJsonPath('user.role', 'homeowner')
            ->assertJsonStructure(['user', 'token']);

        $this->assertDatabaseHas('users', ['email' => 'test@example.com', 'role' => 'homeowner']);
    }

    public function test_registration_rejects_an_invalid_role(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('role');
    }

    public function test_registration_rejects_admin_and_superadmin_roles(): void
    {
        foreach (['admin', 'superadmin'] as $role) {
            $response = $this->postJson('/api/auth/register', [
                'name' => 'Test User',
                'email' => "test-{$role}@example.com",
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => $role,
            ]);

            $response->assertStatus(422)->assertJsonValidationErrors('role');
            $this->assertDatabaseMissing('users', ['email' => "test-{$role}@example.com"]);
        }
    }

    public function test_a_user_can_log_in_with_correct_credentials(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['user', 'token']);
    }

    public function test_login_fails_with_incorrect_credentials(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401);
    }

    public function test_the_authenticated_user_can_be_fetched_with_a_valid_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile')->plainTextToken;

        $response = $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(200)->assertJsonPath('email', $user->email);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_a_user_can_log_out_and_the_token_is_revoked(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile');

        $this->postJson('/api/auth/logout', [], [
            'Authorization' => "Bearer {$token->plainTextToken}",
        ])->assertStatus(204);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
    }

    public function test_ai_plan_requires_authentication(): void
    {
        $this->postJson('/api/ai/plan', ['brief' => 'test'])->assertStatus(401);
    }
}
