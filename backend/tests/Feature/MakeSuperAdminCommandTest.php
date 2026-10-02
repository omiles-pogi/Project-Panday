<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MakeSuperAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_new_superadmin(): void
    {
        $this->artisan('make:superadmin', [
            'name' => 'Root Admin',
            'email' => 'root@example.com',
            'password' => 'password123',
        ])->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'email' => 'root@example.com',
            'role' => 'superadmin',
        ]);
    }

    public function test_it_promotes_an_existing_user_to_superadmin(): void
    {
        $user = User::factory()->create([
            'email' => 'existing@example.com',
            'password' => Hash::make('password123'),
            'role' => 'homeowner',
        ]);

        $this->artisan('make:superadmin', [
            'name' => 'ignored',
            'email' => 'existing@example.com',
            'password' => 'ignored',
        ])->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'role' => 'superadmin',
        ]);
    }

    public function test_it_rejects_an_invalid_email(): void
    {
        $this->artisan('make:superadmin', [
            'name' => 'Root Admin',
            'email' => 'not-an-email',
            'password' => 'password123',
        ])->assertExitCode(1);

        $this->assertDatabaseMissing('users', ['name' => 'Root Admin']);
    }
}
