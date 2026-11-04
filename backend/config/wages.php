<?php

/*
 * Defaults used to fill in team wages automatically (App\Services\WageService) when nobody has set one.
 * They're starting points the homeowner can change per person — adjust them to local rates.
 */
return [
    // Day rate (₱) for a worker who hasn't stated a minimum daily wage.
    'default_daily_rate' => (int) env('WAGE_DEFAULT_DAILY_RATE', 850),

    // Working days in a month (six-day weeks), to turn a project's timeline into days of work.
    'working_days_per_month' => (int) env('WAGE_WORKING_DAYS_PER_MONTH', 26),

    // Contractor fee as a % of the project estimate, used only when the approved plan has no
    // "Contractor and Project Management Fee" line to draw it from.
    'contractor_fee_pct' => (float) env('WAGE_CONTRACTOR_FEE_PCT', 10),
];
