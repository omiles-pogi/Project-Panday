<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Delivers a notification to the phones its recipient is signed in on, through Expo's push
 * service, so it reaches them with the app closed. The in-app notification is the record; this is
 * only the nudge, so it must never get in the way: a recipient with no registered phone costs
 * nothing, and an unreachable push service is logged and ignored.
 */
class PushService
{
    public function notify(User $recipient, AppNotification $notification): void
    {
        $tokens = $recipient->deviceTokens()->pluck('token')->all();
        if ($tokens === []) {
            return;
        }

        $messages = array_map(fn (string $token) => [
            'to' => $token,
            'title' => $notification->title,
            'body' => $notification->body,
            'sound' => 'default',
            'channelId' => 'default',
            // What the app needs to open the right screen when the push is tapped.
            'data' => array_merge($notification->data ?? [], ['type' => $notification->type, 'notificationId' => $notification->id]),
        ], $tokens);

        try {
            $request = Http::timeout(5)->acceptJson();
            if ($accessToken = config('services.expo_push.access_token')) {
                $request = $request->withToken($accessToken);
            }

            $response = $request->post(config('services.expo_push.url'), $messages);
            $this->forgetDeadTokens($tokens, $response->json('data') ?? []);
        } catch (Throwable $e) {
            Log::warning('Push notification could not be delivered.', ['notification' => $notification->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Expo answers with one ticket per message, in order. A phone that uninstalled the app (or
     * whose token lapsed) will never accept another push, so stop sending to it.
     *
     * @param  array<int, string>  $tokens
     * @param  array<int, mixed>  $tickets
     */
    private function forgetDeadTokens(array $tokens, array $tickets): void
    {
        foreach ($tickets as $index => $ticket) {
            if (is_array($ticket) && ($ticket['status'] ?? null) === 'error' && ($ticket['details']['error'] ?? null) === 'DeviceNotRegistered' && isset($tokens[$index])) {
                DeviceToken::where('token', $tokens[$index])->delete();
            }
        }
    }
}
