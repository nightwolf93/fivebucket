<?php

namespace App\Support;

use App\Models\Plan;
use Illuminate\Support\Collection;

class PricingCatalog
{
    public const OVERAGE_STORAGE_CENTS_PER_GB = 10;

    private const PLANS = [
        'free' => [
            'name' => 'Free',
            'price' => '0 €/mois',
            'description' => 'Pour lancer un serveur ou tester FiveBucket sans engagement.',
            'included' => '1 Go médias',
            'included_bytes' => Plan::FREE_BYTES,
            'monthly_price_cents' => 0,
            'max_upload_bytes' => 256 * 1024 * 1024,
            'features' => [
                '1 Go médias',
                'Logs 7 jours',
                '250 Mo logs/mois',
                'Support communautaire',
            ],
            'stripe_env' => 'STRIPE_PRICE_FREE',
        ],
        'growth-10gb' => [
            'name' => 'Starter',
            'price' => '3,49 €/mois TTC',
            'description' => 'Pour les serveurs actifs qui veulent plus de marge médias et logs.',
            'included' => '10 Go médias',
            'included_bytes' => Plan::GROWTH_BYTES,
            'monthly_price_cents' => 349,
            'max_upload_bytes' => 2 * 1024 * 1024 * 1024,
            'highlighted' => true,
            'features' => [
                '10 Go médias',
                'Logs 14 jours',
                '5 Go logs bruts/mois',
                '2M lectures médias/mois',
            ],
            'stripe_env' => 'STRIPE_PRICE_GROWTH_10GB',
        ],
        'scale-100gb' => [
            'name' => 'Pro',
            'price' => '14,99 €/mois TTC',
            'description' => 'Pour les serveurs qui ont besoin d’un historique plus long et de gros volumes.',
            'included' => '100 Go médias',
            'included_bytes' => Plan::SCALE_BYTES,
            'monthly_price_cents' => 1499,
            'max_upload_bytes' => null,
            'features' => [
                '100 Go médias',
                'Logs 30 jours',
                '50 Go logs bruts/mois',
                '10M lectures médias/mois',
            ],
            'stripe_env' => 'STRIPE_PRICE_SCALE_100GB',
        ],
    ];

    private const EXTRAS = [
        ['label' => 'Stockage média additionnel', 'price' => '0,10 €/Go/mois TTC'],
        ['label' => 'Lectures médias additionnelles', 'price' => '0,50 €/million TTC'],
        ['label' => 'Uploads et listings additionnels', 'price' => '6 €/million TTC'],
        ['label' => 'Logs additionnels', 'price' => '0,10 €/Go brut ingéré TTC'],
    ];

    public static function slugs(): array
    {
        return array_keys(self::PLANS);
    }

    public static function pagePayload(?Collection $records = null): array
    {
        return [
            'plans' => self::plans($records),
            'extras' => self::extras(),
        ];
    }

    public static function plans(?Collection $records = null): array
    {
        $records = $records?->keyBy('slug') ?? collect();

        return collect(self::PLANS)
            ->map(fn (array $plan, string $slug) => self::planPayload($slug, $plan, $records->get($slug)))
            ->values()
            ->all();
    }

    public static function planFromRecord(Plan $record): array
    {
        $plan = self::PLANS[$record->slug] ?? null;

        if ($plan) {
            return self::planPayload($record->slug, $plan, $record);
        }

        return [
            'name' => $record->name,
            'slug' => $record->slug,
            'price' => self::money((int) $record->monthly_price_cents).'/mois TTC',
            'monthly' => self::money((int) $record->monthly_price_cents).'/mois TTC',
            'description' => 'Plan personnalisé.',
            'included' => ByteFormatter::human((int) $record->included_bytes).' médias',
            'includedBytes' => (int) $record->included_bytes,
            'features' => [ByteFormatter::human((int) $record->included_bytes).' médias'],
            'overage' => self::money((int) $record->overage_price_cents_per_gb).'/Go',
            'checkoutReady' => filled($record->stripe_price_id),
            'stripeReady' => filled($record->stripe_price_id),
            'highlighted' => false,
            'isFree' => (int) $record->monthly_price_cents === 0,
        ];
    }

    public static function seedPlans(): array
    {
        return collect(self::PLANS)
            ->map(function (array $plan, string $slug) {
                $stripePriceId = env($plan['stripe_env']);

                return [
                    'name' => $plan['name'],
                    'slug' => $slug,
                    'included_bytes' => $plan['included_bytes'],
                    'monthly_price_cents' => $plan['monthly_price_cents'],
                    'overage_price_cents_per_gb' => self::OVERAGE_STORAGE_CENTS_PER_GB,
                    'max_upload_bytes' => $plan['max_upload_bytes'],
                    'stripe_price_id' => filled($stripePriceId) ? $stripePriceId : null,
                    'is_active' => true,
                ];
            })
            ->values()
            ->all();
    }

    public static function extras(): array
    {
        return self::EXTRAS;
    }

    public static function money(int $cents): string
    {
        return number_format($cents / 100, 2, ',', ' ').' €';
    }

    private static function planPayload(string $slug, array $plan, ?Plan $record = null): array
    {
        $checkoutReady = $slug !== 'free' && filled($record?->stripe_price_id);

        return [
            'name' => $plan['name'],
            'slug' => $slug,
            'price' => $plan['price'],
            'monthly' => $plan['price'],
            'description' => $plan['description'],
            'included' => $plan['included'],
            'includedBytes' => (int) ($record?->included_bytes ?? $plan['included_bytes']),
            'features' => $plan['features'],
            'overage' => self::money(self::OVERAGE_STORAGE_CENTS_PER_GB).'/Go',
            'checkoutReady' => $checkoutReady,
            'stripeReady' => filled($record?->stripe_price_id),
            'highlighted' => (bool) ($plan['highlighted'] ?? false),
            'isFree' => $slug === 'free',
        ];
    }
}
