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
        Schema::create('media_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('api_token_id')->nullable()->constrained('api_tokens')->nullOnDelete();
            $table->string('public_id')->unique();
            $table->string('filename');
            $table->string('storage_key')->unique();
            $table->string('path')->nullable()->index();
            $table->string('mime_type')->nullable();
            $table->string('extension', 24)->nullable();
            $table->string('type', 24)->index();
            $table->unsignedBigInteger('size_bytes');
            $table->json('metadata')->nullable();
            $table->boolean('retention_exempt')->default(false);
            $table->string('url')->nullable();
            $table->string('original_url')->nullable();
            $table->timestamp('deleted_at')->nullable()->index();
            $table->timestamps();

            $table->index(['team_id', 'type']);
            $table->index(['team_id', 'path']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('media_files');
    }
};
