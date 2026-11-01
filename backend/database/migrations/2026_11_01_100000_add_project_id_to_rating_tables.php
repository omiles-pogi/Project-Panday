<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A rating can now belong to a finished project: the homeowner rates each worker/contractor on
     * their team once the project hits 100%. project_id stays nullable for the older free-standing
     * ratings (Find Team screen), and the unique index stops a second rating for the same person on
     * the same project (NULLs never collide, so legacy rows are unaffected).
     */
    public function up(): void
    {
        Schema::table('worker_ratings', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('rater_id')->constrained()->cascadeOnDelete();
            $table->unique(['project_id', 'rater_id', 'worker_id']);
        });

        Schema::table('contractor_ratings', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('rater_id')->constrained()->cascadeOnDelete();
            $table->unique(['project_id', 'rater_id', 'contractor_id']);
        });
    }

    public function down(): void
    {
        Schema::table('worker_ratings', function (Blueprint $table) {
            $table->dropUnique(['project_id', 'rater_id', 'worker_id']);
            $table->dropConstrainedForeignId('project_id');
        });

        Schema::table('contractor_ratings', function (Blueprint $table) {
            $table->dropUnique(['project_id', 'rater_id', 'contractor_id']);
            $table->dropConstrainedForeignId('project_id');
        });
    }
};
