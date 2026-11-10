<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The app already refuses a second pending invite/application for the same project + person
 * (ProjectService::hasPendingRequest/hasPendingContractorRequest), but that check and the insert
 * that follows it aren't atomic — two near-simultaneous requests (a double-tap, two homeowner
 * sessions) can both pass the check before either row exists. A unique index closes that race.
 *
 * It can't simply be a unique (project_id, worker_id, status) index: approved/rejected rows are
 * history, not a current state, and the app legitimately creates more than one of each (e.g. a
 * contractor who leaves and is invited again). So pending_worker_id/pending_contractor_id mirror
 * worker_id/contractor_id only while status is 'pending' (kept in sync by the model's saving
 * event) and are null otherwise — nulls never collide in a unique index, so only two truly
 * simultaneous *pending* rows for the same project+person can ever conflict.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_worker_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('pending_worker_id')->nullable()->after('worker_id');
        });
        DB::statement("update project_worker_requests set pending_worker_id = worker_id where status = 'pending'");
        Schema::table('project_worker_requests', function (Blueprint $table) {
            $table->unique(['project_id', 'pending_worker_id'], 'pwr_project_pending_worker_unique');
        });

        Schema::table('project_contractor_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('pending_contractor_id')->nullable()->after('contractor_id');
        });
        DB::statement("update project_contractor_requests set pending_contractor_id = contractor_id where status = 'pending'");
        Schema::table('project_contractor_requests', function (Blueprint $table) {
            $table->unique(['project_id', 'pending_contractor_id'], 'pcr_project_pending_contractor_unique');
        });
    }

    public function down(): void
    {
        Schema::table('project_worker_requests', function (Blueprint $table) {
            $table->dropUnique('pwr_project_pending_worker_unique');
            $table->dropColumn('pending_worker_id');
        });

        Schema::table('project_contractor_requests', function (Blueprint $table) {
            $table->dropUnique('pcr_project_pending_contractor_unique');
            $table->dropColumn('pending_contractor_id');
        });
    }
};
