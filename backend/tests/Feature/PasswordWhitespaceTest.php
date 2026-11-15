<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AccountPasswordRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PasswordWhitespaceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    public function test_legacy_credentials_authenticate_exactly_but_only_issue_a_limited_update_session_for_each_role(): void
    {
        foreach (User::SELF_REGISTERABLE_ROLES as $role) {
            $legacy = " Legacy{$role}1\t";
            $user = User::factory()->create(['role' => $role, 'approval_status' => 'approved', 'password' => Hash::make($legacy)]);
            $before = $user->fresh()->getRawOriginal();
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => trim($legacy)])->assertUnauthorized();
            $login = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => $legacy])
                ->assertOk()->assertJsonPath('user.requires_password_update', true);
            $token = $user->tokens()->latest('id')->firstOrFail();
            $this->assertSame([AccountPasswordRules::UPDATE_ABILITY], $token->abilities);
            $this->assertNotNull($token->expires_at);
            $this->assertSame($before, $user->fresh()->getRawOriginal());
            // Use real bearer-token middleware rather than Sanctum's unrestricted test helper.
            $this->app['auth']->forgetGuards();
            $headers = ['Authorization' => 'Bearer '.$login->json('token')];
            $this->getJson('/api/auth/me', $headers)->assertOk()->assertJsonPath('requires_password_update', true);
            $this->getJson('/api/account', $headers)->assertForbidden()->assertJsonPath('code', 'password_update_required');
            $this->getJson('/api/notifications', $headers)->assertForbidden();
            $this->postJson('/api/ai/plan', [], $headers)->assertForbidden();
            $this->postJson('/api/account/password', ['current_password' => $legacy, 'password' => 'New pass123', 'password_confirmation' => 'New pass123'], $headers)
                ->assertUnprocessable()->assertJsonValidationErrors('password');
            $this->assertTrue(Hash::check($legacy, $user->fresh()->password));
            $this->postJson('/api/account/password', ['current_password' => $legacy, 'password' => 'Newpass123', 'password_confirmation' => 'Newpass123'], $headers)->assertOk();
            $this->assertTrue(Hash::check('Newpass123', $user->fresh()->password));
            $this->assertSame(0, $user->tokens()->count());
            $this->app['auth']->forgetGuards();
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Newpass123'])->assertOk()->assertJsonPath('user.requires_password_update', false);
            $this->app['auth']->forgetGuards();
        }
    }

    public function test_change_password_rejects_all_whitespace_without_changing_credentials_or_sessions(): void
    {
        $user = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved', 'password' => Hash::make('Existing123')]);
        Sanctum::actingAs($user);
        $before = $user->password;
        foreach ([' ', "\t", "\n", "\r", "\v", "\f", "\u{0085}", "\u{00a0}", "\u{1680}", "\u{2003}", "\u{200b}", "\u{2028}", "\u{2029}", "\u{202f}", "\u{205f}", "\u{2060}", "\u{3000}", "\u{feff}"] as $space) {
            $password = 'New'.$space.'pass123';
            $this->postJson('/api/account/password', ['current_password' => 'Existing123', 'password' => $password, 'password_confirmation' => $password])
                ->assertUnprocessable()->assertJsonPath('errors.password.0', 'Passwords cannot contain spaces or whitespace characters.');
            $this->assertSame($before, $user->fresh()->password);
        }
    }

    public function test_a_rejected_account_does_not_receive_an_update_token_for_a_legacy_password(): void
    {
        $user = User::factory()->create(['role' => 'worker', 'approval_status' => 'rejected', 'password' => Hash::make('Legacy pass123')]);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Legacy pass123'])->assertForbidden()->assertJsonMissingPath('token');
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_limited_sessions_can_log_out_and_expire_without_changing_the_legacy_password(): void
    {
        $user = User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved', 'password' => Hash::make('Legacy pass123')]);
        $before = $user->fresh()->password;
        $login = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Legacy pass123'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/logout', [], ['Authorization' => 'Bearer '.$login->json('token')])->assertNoContent();
        $this->assertSame(0, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $expired = $user->createToken('password-update', [AccountPasswordRules::UPDATE_ABILITY], now()->subMinute())->plainTextToken;
        $this->getJson('/api/auth/me', ['Authorization' => 'Bearer '.$expired])->assertUnauthorized();
        $this->assertSame($before, $user->fresh()->password);
    }
}
