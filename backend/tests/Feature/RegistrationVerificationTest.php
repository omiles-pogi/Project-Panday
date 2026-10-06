<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class RegistrationVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Keep these tests offline and independent of the disposable-email package.
        Validator::extend('indisposable', fn () => true);
    }

    /** @param array<string, mixed> $extra */
    private function register(string $role, array $extra = [])
    {
        return $this->postJson('/api/auth/register', array_merge([
            'name' => 'Test User',
            'email' => "{$role}@gmail.com",
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => $role,
        ], $extra));
    }

    public function test_contractor_must_provide_business_name_and_license(): void
    {
        $this->register('contractor')->assertStatus(422)->assertJsonValidationErrors(['business_name', 'license_number']);
    }

    public function test_supplier_must_provide_business_name_and_license(): void
    {
        $this->register('supplier')->assertStatus(422)->assertJsonValidationErrors(['business_name', 'license_number']);
    }

    public function test_worker_must_provide_license_but_not_business_name(): void
    {
        $this->register('worker')->assertStatus(422)->assertJsonValidationErrors(['license_number'])
            ->assertJsonMissingValidationErrors(['business_name']);
    }

    public function test_homeowner_needs_no_verification_details(): void
    {
        $this->register('homeowner')->assertStatus(201);
    }

    public function test_verification_details_are_saved_for_admin_review(): void
    {
        $this->register('contractor', ['business_name' => 'Cruz Builders', 'license_number' => 'PCAB-12345'])->assertStatus(201);

        $this->assertDatabaseHas('users', [
            'email' => 'contractor@gmail.com',
            'business_name' => 'Cruz Builders',
            'license_number' => 'PCAB-12345',
            'approval_status' => 'pending',
        ]);
    }

    public function test_homeowner_never_stores_verification_details(): void
    {
        $this->register('homeowner', ['business_name' => 'x', 'license_number' => 'ABCD1234'])->assertStatus(201);

        $this->assertDatabaseHas('users', ['email' => 'homeowner@gmail.com', 'business_name' => null, 'license_number' => null]);
    }
}
