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
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            // Client-generated id for the send attempt — a retried request (flaky mobile network)
            // with the same key returns the original message instead of storing a duplicate.
            $table->string('client_key', 64)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'sender_id', 'client_key']);
            $table->index(['conversation_id', 'id']);
            $table->index(['conversation_id', 'read_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
