<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marks a wage the app worked out itself (WageService) as opposed to one a person agreed. Only
     * automatic wages are kept up to date when the inputs change; setting a wage by hand turns it off
     * so the app never overwrites a figure someone chose.
     */
    public function up(): void
    {
        foreach (['project_workers', 'project_contractors'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->boolean('wage_auto')->default(false);
            });
        }
    }

    public function down(): void
    {
        foreach (['project_workers', 'project_contractors'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn('wage_auto');
            });
        }
    }
};
