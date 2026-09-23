<?php

use App\Http\Controllers\Api\ConstructionPlanController;
use Illuminate\Support\Facades\Route;

Route::post('/ai/plan', [ConstructionPlanController::class, 'store']);
