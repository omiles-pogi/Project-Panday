<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A project's timeline used to be a plain whole number of months. It can now be expressed in
 * days, weeks or months — so the column that held it is renamed to `timeline_value` and paired
 * with a `timeline_unit`. Every existing row's number was always a month count, so the backfilled
 * default of 'months' keeps their meaning exactly as it was.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->renameColumn('timeline_months', 'timeline_value');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->string('timeline_unit')->default('months')->after('timeline_value');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('timeline_unit');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->renameColumn('timeline_value', 'timeline_months');
        });
    }
};
