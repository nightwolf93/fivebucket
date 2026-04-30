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
        Schema::create('sdk_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('api_token_id')->nullable()->constrained('api_tokens')->nullOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->string('sdk_type');
            $table->string('endpoint')->nullable();
            $table->string('resource_name')->nullable();
            $table->string('universe_id')->nullable();
            $table->string('job_id')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('invalidated_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sdk_sessions');
    }
};
