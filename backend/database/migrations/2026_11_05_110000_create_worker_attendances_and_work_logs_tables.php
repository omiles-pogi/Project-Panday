<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What a worker does on site: one attendance row per project per day (check-in, and check-out
     * once they leave) and one daily work log per project per day. Earnings are worked out from
     * the attendance days and the wage on the worker's project link, so they aren't stored.
     */
    public function up(): void
    {
        Schema::create('worker_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_id')->constrained('users')->cascadeOnDelete();
            $table->date('work_date');
            $table->timestamp('check_in_at');
            $table->timestamp('check_out_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'worker_id', 'work_date']);
            $table->index(['worker_id', 'work_date']);
        });

        Schema::create('worker_work_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_id')->constrained('users')->cascadeOnDelete();
            $table->date('log_date');
            $table->text('summary');
            $table->timestamps();

            $table->unique(['project_id', 'worker_id', 'log_date']);
            $table->index(['worker_id', 'log_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_work_logs');
        Schema::dropIfExists('worker_attendances');
    }
};
