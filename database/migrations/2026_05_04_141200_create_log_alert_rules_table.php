<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('log_alert_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('log_webhook_endpoint_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 100);
            $table->json('filters');
            $table->unsignedInteger('threshold_count')->default(1);
            $table->unsignedInteger('window_minutes')->default(5);
            $table->unsignedInteger('cooldown_minutes')->default(10);
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_triggered_at')->nullable();
            $table->unsignedInteger('last_count')->default(0);
            $table->timestamp('last_checked_at')->nullable();
            $table->text('message_template')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'enabled']);
            $table->index(['team_id', 'last_triggered_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('log_alert_rules');
    }
};
