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
        Schema::table('teams', function (Blueprint $table) {
            $table->string('public_base_url')->nullable()->after('stripe_customer_id');
            $table->string('custom_domain')->nullable()->after('public_base_url');
            $table->timestamp('custom_domain_verified_at')->nullable()->after('custom_domain');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn(['public_base_url', 'custom_domain', 'custom_domain_verified_at']);
        });
    }
};
