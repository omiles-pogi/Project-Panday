<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Supplier bidding. A homeowner (or a contractor on their project) posts a quote request — a list
     * of materials — and suppliers each bid a price per item; the requester compares the bids and
     * awards one. A supplier has at most one bid per request (they revise it, not stack them), and a
     * bid prices every item so the totals can be compared like for like.
     */
    public function up(): void
    {
        Schema::create('quote_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('notes')->nullable();
            $table->date('needed_by')->nullable();
            // open: taking bids · awarded: a bid was chosen · cancelled: withdrawn by the requester
            $table->string('status', 20)->default('open');
            $table->unsignedBigInteger('awarded_bid_id')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        Schema::create('quote_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_request_id')->constrained()->cascadeOnDelete();
            $table->string('material_name');
            $table->string('unit', 30);
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });

        Schema::create('quote_bids', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('total');
            $table->unsignedSmallInteger('delivery_days');
            $table->text('note')->nullable();
            // pending: waiting · accepted: awarded · rejected: another bid won · withdrawn: taken back
            $table->string('status', 20)->default('pending');
            $table->timestamps();

            $table->unique(['quote_request_id', 'supplier_id']);
        });

        Schema::create('quote_bid_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quote_request_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('unit_price');
            $table->timestamps();

            $table->unique(['quote_bid_id', 'quote_request_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_bid_items');
        Schema::dropIfExists('quote_bids');
        Schema::dropIfExists('quote_request_items');
        Schema::dropIfExists('quote_requests');
    }
};
