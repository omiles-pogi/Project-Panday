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
        Schema::table('supplier_products', function (Blueprint $table) {
            // Units promised to supplier-confirmed orders but not yet delivered. `stock` stays the
            // physical on-hand count; available-to-promise is always stock - reserved. Only
            // StockService changes this, with conditional single-statement updates.
            $table->unsignedInteger('reserved')->default(0)->after('stock');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->dropColumn('reserved');
        });
    }
};
