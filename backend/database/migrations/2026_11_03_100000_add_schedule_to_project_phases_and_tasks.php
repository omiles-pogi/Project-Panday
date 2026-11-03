<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Calendar monitoring: each phase carries the AI's proposed schedule window, and each task
     * remembers when it was actually completed so actual progress can be replayed month by month.
     * planned_start/planned_end stay nullable — phases created before this feature are scheduled
     * lazily by TimelineService::ensureSchedule().
     */
    public function up(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->unsignedSmallInteger('duration_weeks')->nullable()->after('progress_pct');
            $table->date('planned_start')->nullable()->after('duration_weeks');
            $table->date('planned_end')->nullable()->after('planned_start');
        });

        Schema::table('project_phase_tasks', function (Blueprint $table) {
            $table->timestamp('completed_at')->nullable()->after('is_done');
        });

        // Best available approximation for tasks that were already checked off.
        DB::table('project_phase_tasks')->where('is_done', true)->update(['completed_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('project_phase_tasks', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });

        Schema::table('project_phases', function (Blueprint $table) {
            $table->dropColumn(['duration_weeks', 'planned_start', 'planned_end']);
        });
    }
};
