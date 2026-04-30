<?php

return [
    'storage_disk' => env('FIVEBUCKET_STORAGE_DISK', env('FILESYSTEM_DISK', 'public')),
    'public_base_url' => env('FIVEBUCKET_PUBLIC_BASE_URL'),
    'presigned_ttl_minutes' => (int) env('FIVEBUCKET_PRESIGNED_TTL_MINUTES', 15),
    'token_secret' => env('FIVEBUCKET_TOKEN_SECRET', env('APP_KEY')),
    'default_overage_price_cents_per_gb' => (int) env('FIVEBUCKET_OVERAGE_PRICE_CENTS_PER_GB', 0),
    'logs' => [
        'driver' => env('FIVEBUCKET_LOGS_DRIVER', 'database'),
        'clickhouse' => [
            'url' => env('CLICKHOUSE_URL', 'http://127.0.0.1:8123'),
            'database' => env('CLICKHOUSE_DATABASE', 'default'),
            'username' => env('CLICKHOUSE_USERNAME'),
            'password' => env('CLICKHOUSE_PASSWORD'),
            'table' => env('CLICKHOUSE_LOGS_TABLE', 'fivebucket_logs'),
            'ttl_days' => (int) env('CLICKHOUSE_LOGS_TTL_DAYS', 90),
            'timeout' => (int) env('CLICKHOUSE_TIMEOUT', 10),
        ],
    ],
    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],
];
