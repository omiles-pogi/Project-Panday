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
            $table->text('description')->nullable()->after('category');

            // "available" read like stock availability but was really a manual listed/unlisted
            // toggle. Stock status is now always derived from `stock` (see
            // SupplierProduct::stockStatus), so this column is renamed to say what it actually
            // controls: whether the listing is shown in the catalog at all.
            $table->renameColumn('available', 'is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->renameColumn('is_active', 'available');
            $table->dropColumn('description');
        });
    }
};
