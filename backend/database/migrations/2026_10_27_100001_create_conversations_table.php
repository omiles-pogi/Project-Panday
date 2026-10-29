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
        // One homeowner <-> contractor thread per project. Both sides are stored explicitly (not
        // just derived from the project) so the thread and its history survive the contractor
        // being unassigned later — they can still read it, they just can't send any more.
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('homeowner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('contractor_id')->constrained('users')->cascadeOnDelete();
            // Denormalized from the newest message so the inbox can sort without a subquery.
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'homeowner_id', 'contractor_id']);
            $table->index(['homeowner_id', 'last_message_at']);
            $table->index(['contractor_id', 'last_message_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
