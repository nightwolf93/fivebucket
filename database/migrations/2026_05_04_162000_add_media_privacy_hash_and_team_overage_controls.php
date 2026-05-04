<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->string('content_hash', 64)->nullable()->after('size_bytes');
            $table->string('visibility', 16)->default('public')->after('retention_exempt');
            $table->foreignId('duplicate_of_id')->nullable()->after('visibility')->constrained('media_files')->nullOnDelete();

            $table->index(['team_id', 'content_hash']);
            $table->index(['team_id', 'visibility']);
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->boolean('overage_enabled')->default(false)->after('storage_limit_bytes');
            $table->unsignedBigInteger('overage_cap_bytes')->default(0)->after('overage_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->dropConstrainedForeignId('duplicate_of_id');
            $table->dropIndex(['team_id', 'visibility']);
            $table->dropIndex(['team_id', 'content_hash']);
            $table->dropColumn(['content_hash', 'visibility']);
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn(['overage_enabled', 'overage_cap_bytes']);
        });
    }
};
