<?php

namespace Tests\Feature;

use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Mail::fake();
        // Functional cases exercise per-email security separately from IP middleware.
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private function pendingCode(string $email = 'homeowner@panday.test'): User
    {
        $user = User::factory()->create(['email' => $email, 'approval_status' => 'approved']);
        DB::table('password_reset_tokens')->insert([
            'email' => $email, 'token' => Hash::make('123456'), 'created_at' => now(),
        ]);

        return $user;
    }

    private function grant(string $email): string
    {
        return $this->postJson('/api/auth/verify-password-reset-code', ['email' => $email, 'code' => '123456'])
            ->assertOk()->assertJsonPath('expires_in', 300)->json('reset_token');
    }

    private function resetFields(string $email, string $token): array
    {
        return ['email' => $email, 'reset_token' => $token, 'password' => 'new-password-123', 'password_confirmation' => 'new-password-123'];
    }

    public function test_requesting_a_code_preserves_generic_response_and_mail_delivery(): void
    {
        $user = User::factory()->create(['email' => 'homeowner@panday.test']);
        $known = $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        $unknown = $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@panday.test'])->assertOk();
        $this->assertSame($known->json(), $unknown->json());
        $known->assertJsonMissingPath('code')->assertJsonMissingPath('reset_token');
        Mail::assertSent(PasswordResetCodeMail::class, fn ($mail) => $mail->hasTo($user->email));
        Mail::assertSentCount(1);
        $this->assertDatabaseCount('password_reset_tokens', 1);
    }

    public function test_verification_issues_only_a_hashed_single_use_grant_without_changing_password(): void
    {
        $user = $this->pendingCode();
        $before = $user->password;
        $response = $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '123456'])->assertOk();
        $token = $response->json('reset_token');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $response->assertJsonMissingPath('code');
        $this->assertSame($before, $user->fresh()->password);
        $this->assertSame('verified:'.hash('sha256', $token), DB::table('password_reset_tokens')->value('token'));
        $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '123456'])->assertUnprocessable();
    }

    public function test_reset_revokes_sessions_old_password_and_grant_then_allows_new_login(): void
    {
        $user = $this->pendingCode();
        $oldSession = $user->createToken('mobile')->plainTextToken;
        $token = $this->grant($user->email);
        $this->postJson('/api/auth/reset-password', $this->resetFields($user->email, $token))->assertOk();
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
        $this->assertDatabaseCount('password_reset_tokens', 0);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->withHeader('Authorization', "Bearer {$oldSession}")->getJson('/api/auth/me')->assertUnauthorized();
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])->assertUnauthorized();
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'new-password-123'])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/api/auth/reset-password', $this->resetFields($user->email, $token))->assertUnprocessable();
    }

    public function test_direct_reset_without_server_verification_is_rejected(): void
    {
        $user = $this->pendingCode();
        $fields = $this->resetFields($user->email, str_repeat('a', 64));
        $this->postJson('/api/auth/reset-password', $fields)->assertUnprocessable();
        unset($fields['reset_token']);
        $fields['code'] = '123456';
        $this->postJson('/api/auth/reset-password', $fields)->assertUnprocessable()->assertJsonValidationErrors('reset_token');
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_incomplete_nonnumeric_wrong_and_expired_codes_are_rejected(): void
    {
        $user = $this->pendingCode();
        foreach (['12345', 'abcdef', '000000'] as $code) {
            $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => $code])->assertUnprocessable();
        }
        $this->travel(15)->minutes();
        $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '123456'])->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_expired_or_wrong_account_grant_cannot_reset_password(): void
    {
        $user = $this->pendingCode();
        $other = $this->pendingCode('other@panday.test');
        $token = $this->grant($user->email);
        $this->postJson('/api/auth/reset-password', $this->resetFields($other->email, $token))->assertUnprocessable();
        $this->travel(5)->minutes();
        $this->postJson('/api/auth/reset-password', $this->resetFields($user->email, $token))->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_password_validation_does_not_consume_the_valid_grant(): void
    {
        $user = $this->pendingCode();
        $token = $this->grant($user->email);
        $fields = $this->resetFields($user->email, $token);
        $fields['password_confirmation'] = 'not-matching';
        $this->postJson('/api/auth/reset-password', $fields)->assertUnprocessable()->assertJsonValidationErrors('password');
        $fields['password'] = $fields['password_confirmation'] = 'short';
        $this->postJson('/api/auth/reset-password', $fields)->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/auth/reset-password', $this->resetFields($user->email, $token))->assertOk();
    }

    public function test_resend_supersedes_an_otp_and_a_verified_grant(): void
    {
        $user = $this->pendingCode();
        $oldHash = DB::table('password_reset_tokens')->value('token');
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        $this->assertNotSame($oldHash, DB::table('password_reset_tokens')->value('token'));
        $sent = null;
        Mail::assertSent(PasswordResetCodeMail::class, function ($mail) use (&$sent) {
            $sent = $mail->code;

            return true;
        });
        $token = $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => $sent])->assertOk()->json('reset_token');
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        $this->postJson('/api/auth/reset-password', $this->resetFields($user->email, $token))->assertUnprocessable();
    }

    public function test_failed_code_attempts_are_limited_across_ips_and_persist_with_database_cache(): void
    {
        config(['cache.default' => 'database']);
        $user = $this->pendingCode();
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '000000'])->assertUnprocessable();
        }
        $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '123456'])->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_verification_endpoint_has_an_ip_rate_limit(): void
    {
        $this->withMiddleware(ThrottleRequests::class);
        $user = $this->pendingCode();
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '000000'])->assertUnprocessable();
        }
        $this->postJson('/api/auth/verify-password-reset-code', ['email' => $user->email, 'code' => '000000'])->assertStatus(429);
    }
}
