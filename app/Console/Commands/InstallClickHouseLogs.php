<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class InstallClickHouseLogs extends Command
{
    protected $signature = 'fivebucket:logs-install {--force : Run even when the configured log driver is not clickhouse}';

    protected $description = 'Create the ClickHouse table used by FiveBucket log storage.';

    public function handle(): int
    {
        if (! $this->option('force') && config('fivebucket.logs.driver') !== 'clickhouse') {
            $this->warn('FIVEBUCKET_LOGS_DRIVER is not clickhouse. Use --force to create the table anyway.');

            return self::SUCCESS;
        }

        foreach ($this->statements() as $sql) {
            $request = Http::timeout((int) config('fivebucket.logs.clickhouse.timeout', 10))
                ->withBody($sql, 'text/plain');

            if ($username = config('fivebucket.logs.clickhouse.username')) {
                $request = $request->withBasicAuth($username, (string) config('fivebucket.logs.clickhouse.password'));
            }

            $request->post(rtrim((string) config('fivebucket.logs.clickhouse.url'), '/'))->throw();
        }

        $this->info('ClickHouse log table is ready: '.$this->clickHouseTable());

        return self::SUCCESS;
    }

    private function statements(): array
    {
        return [
            $this->schemaSql(),
            ...$this->indexSql(),
        ];
    }

    private function schemaSql(): string
    {
        $ttlDays = (int) config('fivebucket.logs.clickhouse.ttl_days', 90);
        $ttl = $ttlDays > 0 ? "\nTTL toDateTime(created_at) + INTERVAL {$ttlDays} DAY" : '';

        return <<<SQL
CREATE TABLE IF NOT EXISTS {$this->clickHouseTable()} (
    id String,
    team_id UInt64,
    api_token_id Nullable(UInt64),
    level LowCardinality(String),
    message String,
    resource String,
    metadata String,
    occurred_at DateTime64(3),
    created_at DateTime64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (team_id, occurred_at, level, resource){$ttl}
SQL;
    }

    private function indexSql(): array
    {
        $table = $this->clickHouseTable();

        return [
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_metadata_token metadata TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_message_token message TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_request_id JSON_VALUE(metadata, '$.\"request_id\"') TYPE bloom_filter(0.01) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_request_id_alt JSON_VALUE(metadata, '$.\"requestId\"') TYPE bloom_filter(0.01) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_action JSON_VALUE(metadata, '$.\"action\"') TYPE bloom_filter(0.01) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_dataset JSON_VALUE(metadata, '$.\"dataset\"') TYPE bloom_filter(0.01) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_source JSON_VALUE(metadata, '$.\"source\"') TYPE bloom_filter(0.01) GRANULARITY 4",
            "ALTER TABLE {$table} ADD INDEX IF NOT EXISTS idx_fb_char_id JSON_VALUE(metadata, '$.\"charId\"') TYPE bloom_filter(0.01) GRANULARITY 4",
        ];
    }

    private function clickHouseTable(): string
    {
        $database = trim((string) config('fivebucket.logs.clickhouse.database'));
        $table = trim((string) config('fivebucket.logs.clickhouse.table', 'fivebucket_logs'));

        return ($database !== '' ? $this->identifier($database).'.' : '').$this->identifier($table);
    }

    private function identifier(string $identifier): string
    {
        return '`'.str_replace('`', '``', $identifier).'`';
    }
}
