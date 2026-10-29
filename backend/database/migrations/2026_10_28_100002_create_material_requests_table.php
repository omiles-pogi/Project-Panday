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
        // A contractor's list of materials for one project, approved by the project's homeowner.
        // `status` is only the approval lifecycle; per-supplier fulfillment lives on supplier_orders.
        Schema::create('material_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contractor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('homeowner_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('draft');
            $table->text('notes')->nullable();
            // Latest homeowner revision/rejection reason, or a supplier availability problem.
            $table->text('decision_reason')->nullable();
            $table->unsignedBigInteger('estimated_total')->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['contractor_id', 'status']);
            $table->index(['homeowner_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('material_requests');
    }
};
