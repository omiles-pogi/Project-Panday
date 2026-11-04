<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\DeviceToken;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'ExponentPushToken[abc123]';

    private function user(string $role = 'homeowner'): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved']);
    }

    private function notify(User $user): AppNotification
    {
        return app(NotificationService::class)->send($user, 'wage_set', 'Wage set', 'Your wage was set.', ['projectId' => 7]);
    }

    // ---- registering a phone -------------------------------------------------------------------

    public function test_a_phone_registers_its_token_and_repeating_it_changes_nothing(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->postJson('/api/device-tokens', ['token' => self::TOKEN, 'platform' => 'android'])->assertCreated();
        $this->postJson('/api/device-tokens', ['token' => self::TOKEN, 'platform' => 'android'])->assertCreated();

        $this->assertSame(1, DeviceToken::count());
        $this->assertSame($user->id, DeviceToken::first()->user_id);
    }

    public function test_a_phone_that_switches_accounts_follows_the_last_one_to_sign_in(): void
    {
        $first = $this->user();
        $second = $this->user('worker');

        Sanctum::actingAs($first);
        $this->postJson('/api/device-tokens', ['token' => self::TOKEN])->assertCreated();
        Sanctum::actingAs($second);
        $this->postJson('/api/device-tokens', ['token' => self::TOKEN])->assertCreated();

        $this->assertSame(1, DeviceToken::count());
        $this->assertSame($second->id, DeviceToken::first()->user_id);
    }

    public function test_only_real_expo_tokens_are_accepted_and_only_by_signed_in_users(): void
    {
        $this->postJson('/api/device-tokens', ['token' => self::TOKEN])->assertUnauthorized();

        Sanctum::actingAs($this->user());
        $this->postJson('/api/device-tokens', ['token' => 'not-a-token'])->assertStatus(422)->assertJsonValidationErrors('token');
        $this->postJson('/api/device-tokens', ['token' => self::TOKEN, 'platform' => 'windows'])->assertStatus(422)->assertJsonValidationErrors('platform');
        $this->postJson('/api/device-tokens', [])->assertStatus(422);
    }

    public function test_signing_out_removes_only_your_own_token(): void
    {
        $owner = $this->user();
        $other = $this->user('worker');
        DeviceToken::create(['user_id' => $owner->id, 'token' => self::TOKEN]);

        Sanctum::actingAs($other);
        $this->deleteJson('/api/device-tokens', ['token' => self::TOKEN])->assertOk();
        $this->assertSame(1, DeviceToken::count());

        Sanctum::actingAs($owner);
        $this->deleteJson('/api/device-tokens', ['token' => self::TOKEN])->assertOk();
        $this->assertSame(0, DeviceToken::count());
    }

    // ---- sending -------------------------------------------------------------------------------

    public function test_a_notification_is_also_pushed_to_the_recipients_phones(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => [['status' => 'ok', 'id' => 'x']]], 200)]);
        $user = $this->user();
        DeviceToken::create(['user_id' => $user->id, 'token' => self::TOKEN]);

        $notification = $this->notify($user);

        Http::assertSent(function (Request $request) use ($notification) {
            $message = $request->data()[0] ?? [];

            return str_contains($request->url(), 'exp.host/--/api/v2/push/send')
                && $message['to'] === self::TOKEN
                && $message['title'] === 'Wage set'
                && $message['body'] === 'Your wage was set.'
                && $message['data']['type'] === 'wage_set'
                && $message['data']['projectId'] === 7
                && $message['data']['notificationId'] === $notification->id;
        });
    }

    public function test_every_phone_the_user_is_signed_in_on_gets_it_and_nobody_elses_does(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => [['status' => 'ok'], ['status' => 'ok']]], 200)]);
        $user = $this->user();
        DeviceToken::create(['user_id' => $user->id, 'token' => 'ExponentPushToken[phone-a]']);
        DeviceToken::create(['user_id' => $user->id, 'token' => 'ExponentPushToken[phone-b]']);
        DeviceToken::create(['user_id' => $this->user('worker')->id, 'token' => 'ExponentPushToken[someone-else]']);

        $this->notify($user);

        Http::assertSent(fn (Request $request) => collect($request->data())->pluck('to')->sort()->values()->all()
            === ['ExponentPushToken[phone-a]', 'ExponentPushToken[phone-b]']);
    }

    public function test_a_user_with_no_registered_phone_causes_no_push_request(): void
    {
        Http::fake();

        $notification = $this->notify($this->user());

        Http::assertNothingSent();
        $this->assertNotNull($notification->id);
    }

    public function test_a_token_expo_reports_as_dead_is_forgotten(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => [['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']]]], 200)]);
        $user = $this->user();
        DeviceToken::create(['user_id' => $user->id, 'token' => self::TOKEN]);

        $this->notify($user);

        $this->assertSame(0, DeviceToken::count());
    }

    public function test_an_unreachable_push_service_never_breaks_the_notification(): void
    {
        Http::fake(fn () => throw new ConnectionException('Could not resolve host'));
        $user = $this->user();
        DeviceToken::create(['user_id' => $user->id, 'token' => self::TOKEN]);

        $notification = $this->notify($user);

        $this->assertDatabaseHas('app_notifications', ['id' => $notification->id, 'user_id' => $user->id]);
        $this->assertSame(1, DeviceToken::count());
    }

    public function test_an_error_reply_from_expo_keeps_the_notification_and_the_token(): void
    {
        Http::fake(['exp.host/*' => Http::response('Bad gateway', 502)]);
        $user = $this->user();
        DeviceToken::create(['user_id' => $user->id, 'token' => self::TOKEN]);

        $notification = $this->notify($user);

        $this->assertDatabaseHas('app_notifications', ['id' => $notification->id]);
        $this->assertSame(1, DeviceToken::count());
    }
}
