<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApprovalStatusTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $status): User
    {
        return User::factory()->create([
            'email' => 'waiting@gmail.com',
            'password' => 'password123',
            'role' => 'homeowner',
            'approval_status' => $status,
        ]);
    }

    public function test_it_reports_the_current_approval_status_without_a_token(): void
    {
        $user = $this->user('pending');

        $this->postJson('/api/auth/approval-status', ['email' => 'waiting@gmail.com', 'password' => 'password123'])
            ->assertOk()
            ->assertJson(['approval_status' => 'pending'])
            ->assertJsonMissing(['token']);

        $user->update(['approval_status' => 'approved']);

        $this->postJson('/api/auth/approval-status', ['email' => 'waiting@gmail.com', 'password' => 'password123'])
            ->assertOk()
            ->assertJson(['approval_status' => 'approved']);
    }

    public function test_it_rejects_wrong_credentials(): void
    {
        $this->user('pending');

        $this->postJson('/api/auth/approval-status', ['email' => 'waiting@gmail.com', 'password' => 'wrong-password'])
            ->assertStatus(401);
    }

    public function test_login_for_an_unapproved_account_includes_the_status(): void
    {
        $this->user('pending');

        $this->postJson('/api/auth/login', ['email' => 'waiting@gmail.com', 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('approval_status', 'pending');
    }
}
