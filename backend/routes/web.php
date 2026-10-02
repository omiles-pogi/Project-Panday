<?php

use Illuminate\Support\Facades\Route;

// Single-page app: every non-API route renders the same Blade shell and
// React (resources/js/App.tsx) handles navigation client-side by role/section.
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
