<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\AccountService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountManagementTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    public function test_all_four_roles_can_save_replace_and_remove_their_own_private_photo(): void
    {
        Storage::fake('local');
        foreach (User::SELF_REGISTERABLE_ROLES as $role) {
            $user = $this->user($role);
            Sanctum::actingAs($user);
            $this->getJson('/api/account')->assertOk()->assertJsonPath('userId', $user->id)
                ->assertJsonPath('photoUrl', null)->assertJsonPath('preferences.push_enabled', true);
            $first = $this->postJson('/api/account/photo', ['photo' => UploadedFile::fake()->image('first.jpg', 100, 100)])
                ->assertOk()->json('photoUrl');
            $path = $user->fresh()->profile_photo_path;
            Storage::disk('local')->assertExists($path);
            $this->get($first)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
            $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('profile_photo_url', $first)->assertJsonMissingPath('profile_photo_path');
            $second = $this->postJson('/api/account/photo', ['photo' => UploadedFile::fake()->image('replacement.png', 120, 100)])
                ->assertOk()->json('photoUrl');
            $this->assertNotSame($first, $second);
            Storage::disk('local')->assertMissing($path);
            $this->get($first)->assertNotFound();
            $this->deleteJson('/api/account/photo')->assertOk()->assertJsonPath('photoUrl', null);
            $this->get($second)->assertNotFound();
            $this->assertSame('approved', $user->fresh()->approval_status);
        }
    }

    public function test_photo_access_is_authenticated_and_upload_targets_cannot_be_forged(): void
    {
        Storage::fake('local');
        $owner = $this->user('supplier');
        $other = $this->user('contractor');
        $this->postJson('/api/account/photo')->assertUnauthorized();
        Sanctum::actingAs($owner);
        $url = $this->postJson('/api/account/photo', ['photo' => UploadedFile::fake()->image('profile.jpg')])->assertOk()->json('photoUrl');
        $saved = $owner->fresh()->profile_photo_path;
        Sanctum::actingAs($other);
        $this->get($url)->assertForbidden();
        $this->postJson('/api/account/photo', ['user_id' => $owner->id, 'photo' => UploadedFile::fake()->image('forged.jpg')])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->deleteJson('/api/account/photo')->assertOk();
        $this->assertSame($saved, $owner->fresh()->profile_photo_path);
        Storage::disk('local')->assertExists($saved);
    }

    public function test_invalid_and_oversized_photos_leave_the_previous_image_intact(): void
    {
        Storage::fake('local');
        $user = $this->user();
        Sanctum::actingAs($user);
        $url = $this->postJson('/api/account/photo', ['photo' => UploadedFile::fake()->image('valid.jpg')])->assertOk()->json('photoUrl');
        foreach ([UploadedFile::fake()->create('bad.svg', 1, 'image/svg+xml'), UploadedFile::fake()->create('bad.pdf', 1, 'application/pdf'),
            UploadedFile::fake()->image('large.jpg')->size(5121), UploadedFile::fake()->image('wide.png', 4097, 1)] as $photo) {
            $this->postJson('/api/account/photo', ['photo' => $photo])->assertUnprocessable()->assertJsonValidationErrors('photo');
            $this->getJson('/api/account')->assertJsonPath('photoUrl', $url);
        }
        $this->assertCount(1, Storage::disk('local')->allFiles('profile-photos'));
    }

    public function test_preferences_are_owner_specific_and_master_disable_preserves_categories(): void
    {
        $owner = $this->user();
        $other = $this->user('worker');
        Sanctum::actingAs($owner);
        $this->patchJson('/api/account/preferences', ['project_updates' => false, 'messages' => true])->assertOk();
        $this->patchJson('/api/account/preferences', ['push_enabled' => false])->assertOk()
            ->assertJsonPath('preferences.project_updates', false)->assertJsonPath('preferences.messages', true);
        $this->patchJson('/api/account/preferences', ['push_enabled' => true])->assertOk()
            ->assertJsonPath('preferences.project_updates', false)->assertJsonPath('preferences.messages', true);
        $this->patchJson('/api/account/preferences', ['messages' => 'invalid'])->assertUnprocessable();
        $this->patchJson('/api/account/preferences', ['messages' => '0'])->assertOk()->assertJsonPath('preferences.messages', false);
        $this->patchJson('/api/account/preferences', ['messages' => 1])->assertOk()->assertJsonPath('preferences.messages', true);
        $this->patchJson('/api/account/preferences', ['user_id' => $other->id, 'messages' => false])->assertUnprocessable();
        Sanctum::actingAs($other);
        $this->getJson('/api/account')->assertOk()->assertJsonPath('preferences', AccountService::DEFAULT_PREFERENCES);
        $this->assertSame('approved', $owner->fresh()->approval_status);
    }

    public function test_server_enforces_each_push_category_and_keeps_in_app_records_for_every_role(): void
    {
        Http::fake(['*' => Http::response(['data' => [['status' => 'ok']]])]);
        foreach (User::SELF_REGISTERABLE_ROLES as $role) {
            $user = $this->user($role);
            $user->deviceTokens()->create(['token' => 'ExponentPushToken[test-'.$user->id.']', 'platform' => 'android']);
            $service = app(AccountService::class);
            $notifications = app(NotificationService::class);
            $service->updatePreferences($user, ['push_enabled' => false, 'project_updates' => true, 'messages' => true]);
            $notifications->send($user, 'new_message', 'Message', 'Retained in-app message');
            $notifications->send($user, 'project_completed', 'Project update', 'Retained in-app project update');
            $service->updatePreferences($user, ['push_enabled' => true, 'messages' => false]);
            $notifications->send($user, 'new_message', 'Message', 'Category disabled');
            $notifications->send($user, 'worker_invite', 'Invitation', 'Project updates enabled');
            $service->updatePreferences($user, ['messages' => true, 'project_updates' => false]);
            $notifications->send($user, 'supplier_fulfillment_received', 'Materials', 'Project category disabled');
            $notifications->send($user, 'new_message', 'Message', 'Messages enabled');
            $this->assertSame(6, $user->appNotifications()->count());
        }
        Http::assertSentCount(8);
    }

    public function test_change_password_uses_the_existing_policy_and_keeps_only_the_current_mobile_session(): void
    {
        foreach (User::SELF_REGISTERABLE_ROLES as $role) {
            $user = $this->user($role);
            $user->password = Hash::make('Currentpass123');
            $user->save();
            $current = $user->createToken('current-phone');
            $other = $user->createToken('other-phone');
            $this->app['auth']->forgetGuards();
            $this->withToken($current->plainTextToken);
            $this->postJson('/api/account/password', ['current_password' => 'wrong', 'password' => 'Newpassword123', 'password_confirmation' => 'Newpassword123'])
                ->assertUnprocessable()->assertJsonValidationErrors('current_password');
            foreach (['short1', 'abcdefgh', '12345678'] as $invalid) {
                $this->postJson('/api/account/password', ['current_password' => 'Currentpass123', 'password' => $invalid, 'password_confirmation' => $invalid])
                    ->assertUnprocessable()->assertJsonValidationErrors('password');
            }
            $this->assertTrue(Hash::check('Currentpass123', $user->fresh()->password));
            DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => 'test-reset-grant', 'created_at' => now()]);
            // Avoid testing the throttle limit while testing the independent password policy.
            $this->withoutMiddleware(ThrottleRequests::class);
            $this->postJson('/api/account/password', ['current_password' => 'Currentpass123', 'password' => 'Newpassword123', 'password_confirmation' => 'Newpassword123'])->assertOk();
            $this->assertTrue(Hash::check('Newpassword123', $user->fresh()->password));
            $this->assertDatabaseHas('personal_access_tokens', ['id' => $current->accessToken->id]);
            $this->assertDatabaseMissing('personal_access_tokens', ['id' => $other->accessToken->id]);
            $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
            $this->assertSame($role, $user->fresh()->role);
        }
    }

    public function test_restricted_roles_cannot_use_the_mobile_account_endpoints(): void
    {
        foreach (['admin', 'superadmin'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/account')->assertForbidden();
            $this->patchJson('/api/account/preferences', ['push_enabled' => false])->assertForbidden();
        }
    }

    public function test_a_second_authenticated_device_loads_the_same_saved_photo_and_preferences(): void
    {
        Storage::fake('local');
        $user = $this->user();
        $first = $user->createToken('first-device');
        $second = $user->createToken('second-device');
        $this->withToken($first->plainTextToken);
        $url = $this->postJson('/api/account/photo', ['photo' => UploadedFile::fake()->image('profile.jpg')])->assertOk()->json('photoUrl');
        $this->patchJson('/api/account/preferences', ['messages' => false])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($second->plainTextToken);
        $this->getJson('/api/account')->assertOk()->assertJsonPath('photoUrl', $url)->assertJsonPath('preferences.messages', false);
        $this->get($url)->assertOk();
    }
}
