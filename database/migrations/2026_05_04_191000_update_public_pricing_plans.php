<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $plans = [
            [
                'name' => 'Free',
                'slug' => 'free',
                'included_bytes' => 1073741824,
                'monthly_price_cents' => 0,
                'overage_price_cents_per_gb' => 10,
                'max_upload_bytes' => 268435456,
                'stripe_env' => 'STRIPE_PRICE_FREE',
                'is_active' => true,
            ],
            [
                'name' => 'Starter',
                'slug' => 'growth-10gb',
                'included_bytes' => 10737418240,
                'monthly_price_cents' => 349,
                'overage_price_cents_per_gb' => 10,
                'max_upload_bytes' => 2147483648,
                'stripe_env' => 'STRIPE_PRICE_GROWTH_10GB',
                'is_active' => true,
            ],
            [
                'name' => 'Pro',
                'slug' => 'scale-100gb',
                'included_bytes' => 107374182400,
                'monthly_price_cents' => 1499,
                'overage_price_cents_per_gb' => 10,
                'max_upload_bytes' => null,
                'stripe_env' => 'STRIPE_PRICE_SCALE_100GB',
                'is_active' => true,
            ],
        ];

        foreach ($plans as $plan) {
            $stripePriceId = env($plan['stripe_env']);
            unset($plan['stripe_env']);

            $exists = DB::table('plans')->where('slug', $plan['slug'])->exists();
            $values = $plan + ['updated_at' => $now];

            if ($stripePriceId) {
                $values['stripe_price_id'] = $stripePriceId;
            }

            if ($exists) {
                DB::table('plans')->where('slug', $plan['slug'])->update($values);

                continue;
            }

            DB::table('plans')->insert($values + [
                'stripe_price_id' => filled($stripePriceId) ? $stripePriceId : null,
                'created_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('plans')->where('slug', 'growth-10gb')->update([
            'name' => 'Growth',
            'monthly_price_cents' => 0,
            'overage_price_cents_per_gb' => 0,
            'updated_at' => now(),
        ]);

        DB::table('plans')->where('slug', 'scale-100gb')->update([
            'name' => 'Scale',
            'monthly_price_cents' => 0,
            'overage_price_cents_per_gb' => 0,
            'updated_at' => now(),
        ]);
    }
};
