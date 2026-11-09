<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::rename('supplier_orders', 'supplier_fulfillments');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::rename('supplier_fulfillments', 'supplier_orders');
    }
};
