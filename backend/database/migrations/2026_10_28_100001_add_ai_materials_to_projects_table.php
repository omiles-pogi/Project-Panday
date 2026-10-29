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
        Schema::table('projects', function (Blueprint $table) {
            // The AI plan's material list, saved at project creation so the assigned contractor can
            // import it into a material request (the plan itself only lives on the homeowner's device).
            $table->json('ai_materials')->nullable()->after('timeline_months');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('ai_materials');
        });
    }
};
