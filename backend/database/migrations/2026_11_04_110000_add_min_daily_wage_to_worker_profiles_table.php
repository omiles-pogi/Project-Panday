<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The lowest day rate (whole pesos) a worker will take, so homeowners and contractors can see what a
     * skilled worker expects before they invite them. Optional: null = the worker hasn't said.
     */
    public function up(): void
    {
        Schema::table('worker_profiles', function (Blueprint $table) {
            $table->unsignedInteger('min_daily_wage')->nullable()->after('bio');
        });
    }

    public function down(): void
    {
        Schema::table('worker_profiles', function (Blueprint $table) {
            $table->dropColumn('min_daily_wage');
        });
    }
};
