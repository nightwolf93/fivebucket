<?php

namespace App\Services\Logs;

use InvalidArgumentException;

class LogStorageManager
{
    public function resolve(): LogStorage
    {
        return match (config('fivebucket.logs.driver', 'database')) {
            'database' => app(DatabaseLogStorage::class),
            'clickhouse' => app(ClickHouseLogStorage::class),
            default => throw new InvalidArgumentException('Unsupported FiveBucket log storage driver.'),
        };
    }
}
