<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Material planning by phase:
     *  - a project records when its contractor reviewed the AI's material quantities, and whether the
     *    homeowner lets routine requests approve themselves (auto_approve_materials);
     *  - a request can be for one phase, due by a date, and remembers why it needed (or didn't need) a
     *    decision (approval_flags) and whether the app approved it (auto_approved);
     *  - each line keeps the AI's original quantity and the quantity the reviewed plan allows, so the
     *    homeowner can see "AI said 54, contractor asks 70" and the approval rule has something to compare to.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->timestamp('materials_reviewed_at')->nullable();
            $table->foreignId('materials_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('auto_approve_materials')->default(true);
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->foreignId('phase_id')->nullable()->constrained('project_phases')->nullOnDelete();
            $table->date('needed_by')->nullable();
            $table->boolean('auto_approved')->default(false);
            $table->json('approval_flags')->nullable();
        });

        Schema::table('material_request_items', function (Blueprint $table) {
            $table->unsignedInteger('ai_quantity')->nullable();
            $table->unsignedInteger('plan_quantity')->nullable();
            $table->unsignedTinyInteger('waste_pct')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('material_request_items', function (Blueprint $table) {
            $table->dropColumn(['ai_quantity', 'plan_quantity', 'waste_pct']);
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('phase_id');
            $table->dropColumn(['needed_by', 'auto_approved', 'approval_flags']);
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('materials_reviewed_by');
            $table->dropColumn(['materials_reviewed_at', 'auto_approve_materials']);
        });
    }
};
