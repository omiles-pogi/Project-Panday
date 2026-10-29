<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // Two ids are populated: homeowner/contractor, homeowner/worker, or contractor/worker.
            $table->unsignedBigInteger('homeowner_id')->nullable()->change();
            $table->unsignedBigInteger('contractor_id')->nullable()->change();
            $table->foreignId('worker_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->unique(['project_id', 'homeowner_id', 'worker_id']);
            $table->unique(['project_id', 'contractor_id', 'worker_id']);
            $table->index(['worker_id', 'last_message_at']);
        });
    }

    public function down(): void
    {
        // Worker threads cannot be represented by the original two-role schema.
        DB::table('conversations')->whereNotNull('worker_id')->delete();

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropUnique(['project_id', 'homeowner_id', 'worker_id']);
            $table->dropUnique(['project_id', 'contractor_id', 'worker_id']);
            $table->dropIndex(['worker_id', 'last_message_at']);
            $table->dropConstrainedForeignId('worker_id');
            $table->unsignedBigInteger('homeowner_id')->nullable(false)->change();
            $table->unsignedBigInteger('contractor_id')->nullable(false)->change();
        });
    }
};
