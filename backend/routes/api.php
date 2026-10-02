<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConstructionPlanController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/ai/plan', [ConstructionPlanController::class, 'store'])->middleware('throttle:20,1');
});
