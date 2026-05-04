<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('log_webhook_endpoints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('type', 32)->default('discord');
            $table->text('url');
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_used_at')->nullable();
            $table->unsignedSmallInteger('last_status_code')->nullable();
            $table->unsignedInteger('failure_count')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'enabled']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('log_webhook_endpoints');
    }
};
