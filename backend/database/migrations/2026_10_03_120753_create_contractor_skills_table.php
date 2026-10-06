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
        Schema::create('contractor_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contractor_profile_id')->constrained()->cascadeOnDelete();
            $table->string('skill');
            $table->timestamps();

            $table->unique(['contractor_profile_id', 'skill']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contractor_skills');
    }
};
