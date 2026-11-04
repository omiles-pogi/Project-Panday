<?php

/*
 * Material planning defaults (App\Services\MaterialPlanService).
 */
return [
    // How many days before a phase starts its materials should be ordered, so they can be confirmed and delivered.
    'lead_days' => (int) env('MATERIAL_LEAD_DAYS', 7),
];
