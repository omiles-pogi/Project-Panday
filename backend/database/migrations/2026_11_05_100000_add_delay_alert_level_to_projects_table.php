<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Delay alerts: the worst schedule level (0 on track, 1 slightly behind, 2 significantly behind)
     * the project's team has already been told about, so a slip is announced once and again only
     * if it gets worse. See ScheduleAlertService.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->unsignedTinyInteger('delay_alert_level')->default(0)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('delay_alert_level');
        });
    }
};
