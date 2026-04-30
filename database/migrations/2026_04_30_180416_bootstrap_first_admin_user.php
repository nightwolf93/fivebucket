<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::table('users')->where('is_admin', true)->doesntExist()) {
            $firstUser = DB::table('users')->orderBy('id')->first();

            if ($firstUser) {
                DB::table('users')->where('id', $firstUser->id)->update(['is_admin' => true]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
