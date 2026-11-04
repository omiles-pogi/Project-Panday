<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeviceTokenRequest;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceTokenController extends Controller
{
    /** Called by the app after sign-in; harmless to repeat. */
    public function store(StoreDeviceTokenRequest $request): JsonResponse
    {
        $data = $request->validated();

        // A phone that switches accounts keeps a single row, which follows whoever signed in last.
        DeviceToken::updateOrCreate(
            ['token' => $data['token']],
            ['user_id' => $request->user()->id, 'platform' => $data['platform'] ?? null]
        );

        return response()->json(['registered' => true], 201);
    }

    /** Called by the app on sign-out so the next person on that phone isn't sent the last one's alerts. */
    public function destroy(Request $request): JsonResponse
    {
        $token = $request->validate(['token' => ['required', 'string', 'max:255']])['token'];

        DeviceToken::where('user_id', $request->user()->id)->where('token', $token)->delete();

        return response()->json(['removed' => true]);
    }
}
