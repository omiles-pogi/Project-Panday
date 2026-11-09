<?php

namespace Tests\Feature;

use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_known_email_is_sent_a_reset_code(): void
    {
        Mail::fake();
        $user = User::factory()->create(['email' => 'homeowner@panday.test']);

        $this->postJson('/api/auth/forgot-password', ['email' => 'homeowner@panday.test'])
            ->assertStatus(200);

        Mail::assertSent(PasswordResetCodeMail::class, fn ($mail) => $mail->hasTo($user->email));
        $this->assertDatabaseCount('password_reset_tokens', 1);
    }

    public function test_an_unknown_email_gets_the_same_response_but_sends_nothing(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@panday.test'])
            ->assertStatus(200)
            ->assertJsonPath('message', 'If that email is registered, a reset code is on its way.');

        Mail::assertNothingSent();
        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_the_emailed_code_resets_the_password_and_signs_out_other_sessions(): void
    {
        Mail::fake();
        $user = User::factory()->create([
            'email' => 'homeowner@panday.test',
            'password' => Hash::make('old-password'),
            'approval_status' => 'approved',
        ]);
        $oldToken = $user->createToken('mobile')->plainTextToken;

        Mail::to($user->email)->send(new PasswordResetCodeMail($user, '123456'));
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            ['token' => Hash::make('123456'), 'created_at' => now()]
        );

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '123456',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(200);

        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
        $this->assertDatabaseCount('password_reset_tokens', 0);

        // The old token was revoked — it can no longer authenticate.
        $this->withHeader('Authorization', "Bearer {$oldToken}")->getJson('/api/auth/me')->assertStatus(401);

        // The new password works for a fresh login.
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'new-password-123'])
            ->assertStatus(200)
            ->assertJsonStructure(['token']);
    }

    public function test_a_wrong_or_expired_code_is_refused(): void
    {
        $user = User::factory()->create(['email' => 'homeowner@panday.test']);
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make('123456'),
            'created_at' => now(),
        ]);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '000000',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(422);

        // Expired: created 16 minutes ago, past the 15-minute window.
        DB::table('password_reset_tokens')->where('email', $user->email)->update(['created_at' => now()->subMinutes(16)]);
        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '123456',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_reset_password_requires_matching_confirmation_and_a_real_code(): void
    {
        $user = User::factory()->create(['email' => 'homeowner@panday.test']);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '123456',
            'password' => 'new-password-123',
            'password_confirmation' => 'does-not-match',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        // No code was ever requested for this email.
        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => '999999',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(422);
    }
}
