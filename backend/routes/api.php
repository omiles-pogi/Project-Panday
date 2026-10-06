<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConstructionPlanController;
use App\Http\Controllers\Api\ContractorController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectPhaseTaskController;
use App\Http\Controllers\Api\WorkerController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/approval-status', [AuthController::class, 'approvalStatus'])->middleware('throttle:30,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/ai/plan', [ConstructionPlanController::class, 'store'])->middleware('throttle:20,1');
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/dashboard', [ProjectController::class, 'dashboard']);
    Route::post('/projects/{project}/workers', [ProjectController::class, 'assignWorker']);
    Route::delete('/projects/{project}/workers/{worker}', [ProjectController::class, 'unassignWorker']);
    Route::post('/projects/{project}/contractors', [ProjectController::class, 'assignContractor']);
    Route::delete('/projects/{project}/contractors/{contractor}', [ProjectController::class, 'unassignContractor']);
    Route::get('/my-projects', [ProjectController::class, 'myProjects']);

    Route::post('/projects/{project}/phases/{phase}/tasks', [ProjectPhaseTaskController::class, 'store']);
    Route::patch('/projects/{project}/phases/{phase}/tasks/{task}', [ProjectPhaseTaskController::class, 'update']);
    Route::delete('/projects/{project}/phases/{phase}/tasks/{task}', [ProjectPhaseTaskController::class, 'destroy']);

    Route::put('/worker-profile', [WorkerController::class, 'updateProfile'])->middleware('role:worker');
    Route::get('/workers', [WorkerController::class, 'search']);
    Route::get('/workers/{worker}', [WorkerController::class, 'show']);
    Route::post('/workers/{worker}/ratings', [WorkerController::class, 'rate']);

    Route::put('/contractor-profile', [ContractorController::class, 'updateProfile'])->middleware('role:contractor');
    Route::get('/contractors', [ContractorController::class, 'search']);
    Route::get('/contractors/{contractor}', [ContractorController::class, 'show']);
    Route::post('/contractors/{contractor}/ratings', [ContractorController::class, 'rate']);
});

// Web admin portal — only the single configured superadmin account (see EnsurePortalAdmin).
Route::middleware(['auth:sanctum', 'portal.admin'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminController::class, 'stats']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::patch('/users/{user}/approval', [AdminController::class, 'updateApproval']);
    Route::get('/projects', [AdminController::class, 'projects']);
});
