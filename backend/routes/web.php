<?php

use Illuminate\Support\Facades\Route;

// The web UI was removed — clients are the Expo app (frontend/) and the admin page (admin/).
Route::get('/', fn () => response()->json(['name' => 'Project-Panday API']));
