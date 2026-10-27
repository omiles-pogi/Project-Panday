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
        // "app_notifications", not "notifications" — the User model already uses Laravel's own
        // Notifiable trait (for password-reset emails), which reserves the conventional
        // "notifications" table name/shape (uuid id, polymorphic notifiable_type/id). This is an
        // unrelated, custom in-app notification feed, so it gets its own table to avoid colliding.
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('title');
            $table->string('body');
            // Related ids/labels (project_id, project_title, worker_request_id, etc.) — a loose
            // bag instead of nullable FK columns, since different notification types carry
            // different relations and new types shouldn't need a new migration each time.
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app_notifications');
    }
};
