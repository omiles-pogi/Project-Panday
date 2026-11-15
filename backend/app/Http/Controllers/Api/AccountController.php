<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangeAccountPasswordRequest;
use App\Http\Requests\UpdateAccountPreferencesRequest;
use App\Http\Requests\UploadProfilePhotoRequest;
use App\Services\AccountService;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function __construct(private readonly AccountService $accounts) {}

    public function show(Request $request)
    {
        return response()->json($this->accounts->present($request->user()->fresh()))->header('Cache-Control', 'no-store');
    }

    public function preferences(UpdateAccountPreferencesRequest $request)
    {
        return response()->json($this->accounts->updatePreferences($request->user(), $request->validated()));
    }

    public function upload(UploadProfilePhotoRequest $request)
    {
        return response()->json($this->accounts->photo($request->user(), $request->file('photo')));
    }

    public function remove(Request $request)
    {
        return response()->json($this->accounts->photo($request->user(), null));
    }

    public function image(Request $request, int $userId, string $version)
    {
        return $this->accounts->image($request->user(), $userId, $version);
    }

    public function password(ChangeAccountPasswordRequest $request)
    {
        $this->accounts->changePassword($request->user(), $request->validated('current_password'), $request->validated('password'));

        return response()->json(['message' => 'Password updated. Other sessions have been signed out.']);
    }
}
