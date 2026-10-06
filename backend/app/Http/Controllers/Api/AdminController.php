<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateApprovalRequest;
use App\Models\User;
use App\Services\AdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function __construct(private readonly AdminService $admin) {}

    public function stats(): JsonResponse
    {
        return response()->json($this->admin->stats());
    }

    public function users(Request $request): JsonResponse
    {
        return response()->json($this->admin->users(
            $request->query('status'),
            $request->query('role'),
            $request->query('q'),
        ));
    }

    public function projects(Request $request): JsonResponse
    {
        return response()->json($this->admin->projects(
            $request->query('status'),
            $request->query('q'),
        ));
    }

    public function updateApproval(UpdateApprovalRequest $request, User $user): JsonResponse
    {
        if (! $this->admin->isManaged($user)) {
            return response()->json(['error' => 'Admin accounts cannot be changed here.'], 422);
        }

        return response()->json($this->admin->setApproval($user, $request->validated('status')));
    }
}
