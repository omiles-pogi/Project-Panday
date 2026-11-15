<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            // Null preserves legacy behavior; no supplier's inventory is backfilled or attested.
            $table->boolean('stock_is_confirmed')->nullable();
            $table->timestamp('stock_confirmed_at')->nullable();
            $table->unsignedBigInteger('stock_confirmed_by')->nullable();
            $table->unsignedInteger('stock_confirmed_quantity')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->dropColumn(['stock_is_confirmed', 'stock_confirmed_at', 'stock_confirmed_by', 'stock_confirmed_quantity']);
        });
    }
};
