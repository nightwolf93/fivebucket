<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sdk_sessions', function (Blueprint $table) {
            $table->timestamp('last_seen_at')->nullable()->after('expires_at');
            $table->json('metadata')->nullable()->after('job_id');

            $table->index(['team_id', 'expires_at']);
        });

        Schema::create('sdk_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sdk_session_id')->constrained()->cascadeOnDelete();
            $table->string('action_key', 120);
            $table->string('label');
            $table->text('description')->nullable();
            $table->string('category', 80)->nullable();
            $table->json('schema')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('dangerous')->default(false);
            $table->boolean('requires_confirmation')->default(false);
            $table->unsignedInteger('timeout_seconds')->default(30);
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['sdk_session_id', 'action_key']);
            $table->index(['team_id', 'enabled']);
            $table->index(['team_id', 'category']);
        });

        Schema::create('sdk_action_executions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sdk_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sdk_action_id')->nullable()->constrained('sdk_actions')->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action_key', 120);
            $table->string('action_label')->nullable();
            $table->json('params')->nullable();
            $table->string('status', 32)->default('queued');
            $table->json('result')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('requested_at');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['team_id', 'status']);
            $table->index(['sdk_session_id', 'status', 'expires_at']);
            $table->index(['team_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sdk_action_executions');
        Schema::dropIfExists('sdk_actions');

        Schema::table('sdk_sessions', function (Blueprint $table) {
            $table->dropIndex(['team_id', 'expires_at']);
            $table->dropColumn(['last_seen_at', 'metadata']);
        });
    }
};
