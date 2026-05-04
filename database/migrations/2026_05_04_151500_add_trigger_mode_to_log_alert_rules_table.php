<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('log_alert_rules', function (Blueprint $table) {
            $table->string('trigger_mode', 24)->default('threshold')->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('log_alert_rules', function (Blueprint $table) {
            $table->dropColumn('trigger_mode');
        });
    }
};
