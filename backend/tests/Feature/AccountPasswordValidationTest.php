<?php

namespace Tests\Feature;

use App\Http\Requests\RegisterRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AccountPasswordValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Validator::extend('indisposable', fn () => true);
    }

    public static function invalidPasswords(): array
    {
        return [
            'empty' => ['', 'Please enter a password.'],
            'short matching' => ['abc1234', 'at least 8 characters'],
            'letters only' => ['abcdefgh', 'one number'],
            'numbers only' => ['12345678', 'one letter'],
            'no ASCII letter' => ['ééééééé1', 'one letter'],
            'no ASCII digit' => ['abcdefg١', 'one number'],
            'Unicode short despite UTF16 length' => ['a1😀😀😀', 'at least 8 characters'],
            'internal space' => ['Valid 12345', 'cannot contain spaces'],
            'leading space' => [' Valid12345', 'cannot contain spaces'],
            'trailing space' => ['Valid12345 ', 'cannot contain spaces'],
            'tab' => ["Valid\t12345", 'cannot contain spaces'],
            'newline' => ["Valid\n12345", 'cannot contain spaces'],
            'non-breaking space' => ["Valid\u{00a0}12345", 'cannot contain spaces'],
            'next line' => ["Valid\u{0085}12345", 'cannot contain spaces'],
            'zero width' => ["Valid\u{200b}12345", 'cannot contain spaces'],
            'word joiner' => ["Valid\u{2060}12345", 'cannot contain spaces'],
        ];
    }

    #[DataProvider('invalidPasswords')]
    public function test_registration_rejects_invalid_passwords_even_with_matching_confirmation(string $password, string $message): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Validation Account', 'email' => 'validation@gmail.com', 'role' => 'homeowner',
            'password' => $password, 'password_confirmation' => $password,
        ])->assertUnprocessable()->assertJsonValidationErrors('password')->assertJsonMissingPath('token');
        $this->assertStringContainsString($message, $response->json('errors.password.0'));
        $this->assertStringNotContainsString('Passwords do not match', $response->json('errors.password.0'));
        $this->assertDatabaseCount('users', 0);
    }

    #[DataProvider('invalidPasswords')]
    public function test_reset_rejects_invalid_password_without_consuming_server_verified_grant(string $password, string $message): void
    {
        $user = User::factory()->create(['email' => 'reset@panday.test', 'approval_status' => 'approved']);
        $before = $user->password;
        $user->createToken('existing-device');
        DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => Hash::make('123456'), 'created_at' => now()]);
        $grant = $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '123456'])
            ->assertOk()->json('reset_token');
        $savedGrant = DB::table('password_reset_tokens')->value('token');
        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email, 'reset_token' => $grant, 'password' => $password, 'password_confirmation' => $password,
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertStringContainsString($message, $response->json('errors.password.0'));
        $this->assertSame($before, $user->fresh()->password);
        $this->assertSame($savedGrant, DB::table('password_reset_tokens')->value('token'));
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email, 'reset_token' => $grant, 'password' => 'correct123', 'password_confirmation' => 'correct123',
        ])->assertOk();
        $this->assertTrue(Hash::check('correct123', $user->fresh()->password));
        $this->assertDatabaseCount('password_reset_tokens', 0);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_valid_password_registers_each_role_with_unchanged_approval_rules(): void
    {
        foreach (['homeowner', 'contractor', 'supplier', 'worker'] as $role) {
            $response = $this->postJson('/api/auth/register', [
                'name' => 'Validation Account', 'email' => "{$role}@gmail.com", 'role' => $role,
                'password' => 'abcdefg1', 'password_confirmation' => 'abcdefg1',
                'business_name' => 'Validation Business', 'license_number' => 'LICENSE-1234',
            ])->assertCreated()->assertJsonPath('user.approval_status', $role === 'homeowner' ? 'approved' : 'pending');
            if ($role === 'homeowner') {
                $response->assertJsonStructure(['token']);
            } else {
                $response->assertJsonMissingPath('token');
            }
            $user = User::findOrFail($response->json('user.id'));
            $this->assertTrue(Hash::check('abcdefg1', $user->password));
        }
    }

    public function test_valid_password_with_mismatched_confirmation_is_rejected_by_both_endpoints(): void
    {
        $fields = ['name' => 'Validation Account', 'email' => 'validation@gmail.com', 'role' => 'homeowner',
            'password' => 'abcdefgh1', 'password_confirmation' => 'abcdefgh2'];
        $this->postJson('/api/auth/register', $fields)->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Passwords do not match.');
        $this->postJson('/api/auth/reset-password', array_merge($fields, ['reset_token' => str_repeat('a', 64)]))
            ->assertUnprocessable()->assertJsonPath('errors.password.0', 'Passwords do not match.');
    }

    public function test_character_count_and_whitespace_match_frontend_policy_without_trimming_passwords(): void
    {
        foreach (['a1😀😀😀😀😀😀', 'ABCDEFG1'] as $password) {
            $request = new RegisterRequest;
            $validator = Validator::make(['password' => $password, 'password_confirmation' => $password],
                ['password' => $request->rules()['password']], $request->messages());
            $this->assertTrue($validator->passes());
        }
    }
}
