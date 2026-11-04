<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Falling behind is down to time passing, so nobody has to open the calendar for the team to hear
// about it. Needs the scheduler running: `php artisan schedule:work` locally, a `schedule:run` cron in production.
Schedule::command('projects:check-delays')->dailyAt('08:00')->timezone('Asia/Manila');
