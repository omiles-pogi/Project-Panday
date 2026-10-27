<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('project_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            // Denormalized (not an FK to project_phases/project_phase_tasks) so the log still
            // reads correctly even if that phase or task is later edited or removed.
            $table->string('phase_name');
            $table->string('task_description');
            $table->boolean('is_done');
            $table->unsignedTinyInteger('overall_progress_pct');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_activity_logs');
    }
};
