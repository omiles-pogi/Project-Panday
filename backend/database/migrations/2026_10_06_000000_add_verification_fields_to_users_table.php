<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Credentials contractors, suppliers and skilled workers submit at sign-up
            // so an admin can check them before approving the account.
            $table->string('business_name')->nullable()->after('approval_status');
            $table->string('license_number')->nullable()->after('business_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['business_name', 'license_number']);
        });
    }
};
