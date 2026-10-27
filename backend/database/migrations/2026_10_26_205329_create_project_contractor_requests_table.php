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
        // Mirrors project_worker_requests' pending/approved/rejected, either-direction lifecycle,
        // plus the proposal details a contractor's application carries that a worker's doesn't.
        Schema::create('project_contractor_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contractor_id')->constrained('users')->cascadeOnDelete();
            $table->enum('initiated_by', ['homeowner', 'contractor']);
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->unsignedBigInteger('quote_amount')->nullable();
            $table->unsignedInteger('estimated_days')->nullable();
            $table->text('message')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'contractor_id', 'status'], 'pcr_project_contractor_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_contractor_requests');
    }
};
