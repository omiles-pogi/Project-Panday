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
        Schema::table('project_worker_requests', function (Blueprint $table) {
            // Who actually sent a homeowner-direction invite — the project owner themselves, or
            // (new) a contractor already assigned to manage that project. Null for
            // worker-initiated applications, and for any invite rows that predate this column.
            $table->foreignId('invited_by_user_id')->nullable()->after('initiated_by')
                ->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_worker_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invited_by_user_id');
        });
    }
};
