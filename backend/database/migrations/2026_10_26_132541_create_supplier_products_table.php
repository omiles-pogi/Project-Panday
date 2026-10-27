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
        Schema::create('supplier_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('category');
            $table->string('unit');
            $table->unsignedInteger('price'); // PHP, whole pesos
            $table->unsignedInteger('stock')->default(0);
            $table->unsignedInteger('min_order')->default(1);
            $table->boolean('available')->default(true);
            $table->timestamps();

            // The AI material estimator scans available listings by name to find real prices.
            $table->index(['name', 'available']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_products');
    }
};
