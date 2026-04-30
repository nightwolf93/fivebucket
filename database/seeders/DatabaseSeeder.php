<?php

namespace Database\Seeders;

use App\Models\Plan;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Free',
                'slug' => 'free',
                'included_bytes' => Plan::FREE_BYTES,
                'monthly_price_cents' => 0,
                'overage_price_cents_per_gb' => config('fivebucket.default_overage_price_cents_per_gb'),
                'max_upload_bytes' => 256 * 1024 * 1024,
                'stripe_price_id' => env('STRIPE_PRICE_FREE'),
            ],
            [
                'name' => 'Growth',
                'slug' => 'growth-10gb',
                'included_bytes' => Plan::GROWTH_BYTES,
                'monthly_price_cents' => 0,
                'overage_price_cents_per_gb' => config('fivebucket.default_overage_price_cents_per_gb'),
                'max_upload_bytes' => 2 * 1024 * 1024 * 1024,
                'stripe_price_id' => env('STRIPE_PRICE_GROWTH_10GB'),
            ],
            [
                'name' => 'Scale',
                'slug' => 'scale-100gb',
                'included_bytes' => Plan::SCALE_BYTES,
                'monthly_price_cents' => 0,
                'overage_price_cents_per_gb' => config('fivebucket.default_overage_price_cents_per_gb'),
                'max_upload_bytes' => null,
                'stripe_price_id' => env('STRIPE_PRICE_SCALE_100GB'),
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['slug' => $plan['slug']], $plan + ['is_active' => true]);
        }

        // \App\Models\User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);
    }
}
