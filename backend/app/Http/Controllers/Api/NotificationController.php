<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->notifications->listFor($request->user()));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->notifications->unreadCountFor($request->user())]);
    }

    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        return $this->attempt(fn () => $this->notifications->present($this->notifications->markRead($notification, $request->user())));
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $this->notifications->markAllRead($request->user());

        return response()->json(null, 204);
    }

    /** "Clear all": deletes the whole feed, keeping only requests still waiting for the user's answer. */
    public function clearAll(Request $request): JsonResponse
    {
        return response()->json($this->notifications->clearAll($request->user()));
    }

    public function destroy(Request $request, AppNotification $notification): JsonResponse
    {
        return $this->attempt(function () use ($request, $notification) {
            $this->notifications->delete($notification, $request->user());

            return null;
        }, 204);
    }
}
