<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Finishing a project is a two-step handshake: the contractor submits it as finished
     * (status "pending_confirmation"), then the homeowner confirms ("completed") or asks for
     * corrections (back to "active"). `status` is already a plain string, so the new value needs no
     * schema change; these columns record who did what and when.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            // When the contractor marked the construction as finished, and which contractor.
            $table->timestamp('finished_at')->nullable()->after('status');
            $table->foreignId('finished_by')->nullable()->after('finished_at')->constrained('users')->nullOnDelete();
            // When the homeowner confirmed it, making it officially completed.
            $table->timestamp('completion_confirmed_at')->nullable()->after('finished_by');
            // The homeowner's latest request for corrections, shown to the contractor until they resubmit.
            $table->timestamp('corrections_requested_at')->nullable()->after('completion_confirmed_at');
            $table->text('corrections_note')->nullable()->after('corrections_requested_at');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('finished_by');
            $table->dropColumn(['finished_at', 'completion_confirmed_at', 'corrections_requested_at', 'corrections_note']);
        });
    }
};
