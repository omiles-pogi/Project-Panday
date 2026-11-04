<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What a worker or contractor is paid on a project lives on their link to that project, not on
     * their profile — the same person can be paid differently on different jobs. wage_amount is
     * whole pesos and stays null until a wage is agreed; wage_unit says whether it is a day rate
     * (multiplied by wage_days) or a fixed fee for the whole job.
     */
    public function up(): void
    {
        foreach (['project_workers', 'project_contractors'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->unsignedInteger('wage_amount')->nullable();
                $t->string('wage_unit', 10)->default('per_day');
                $t->unsignedSmallInteger('wage_days')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['project_workers', 'project_contractors'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn(['wage_amount', 'wage_unit', 'wage_days']);
            });
        }
    }
};
