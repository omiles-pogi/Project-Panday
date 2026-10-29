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
        Schema::create('material_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_request_id')->constrained()->cascadeOnDelete();
            // Null until the homeowner approves and the item is routed to its supplier's order.
            $table->foreignId('supplier_order_id')->nullable()->constrained()->nullOnDelete();
            // Null for an AI-suggested line not yet matched to a real listing (cannot be submitted).
            $table->foreignId('supplier_product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('users')->nullOnDelete();
            // Snapshots, so later listing edits never silently rewrite an approved request.
            $table->string('material_name');
            $table->string('unit', 30);
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('estimated_unit_price')->default(0);
            $table->unsignedInteger('confirmed_unit_price')->nullable();
            // Units this item currently holds in supplier_products.reserved: what a cancel releases
            // and delivery deducts, then reset to 0 so neither can ever happen twice.
            $table->unsignedInteger('reserved_quantity')->default(0);
            $table->string('status')->default('pending');
            $table->string('source', 10)->default('manual');
            $table->timestamps();

            $table->index(['supplier_id', 'supplier_order_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('material_request_items');
    }
};
