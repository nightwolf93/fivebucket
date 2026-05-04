<?php

namespace App\Services\Logs;

use App\Models\ApiToken;
use App\Models\Team;
use App\Services\Logs\Concerns\FormatsLogRows;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ClickHouseLogStorage implements LogStorage
{
    use FormatsLogRows;

    public function store(Team $team, ?ApiToken $token, array $entries): int
    {
        $rows = [];
        $now = now();

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $occurredAt = $this->timestamp($entry['timestamp'] ?? $entry['occurred_at'] ?? null) ?? $now;

            $rows[] = json_encode([
                'id' => (string) Str::ulid(),
                'team_id' => (int) $team->id,
                'api_token_id' => $token?->id,
                'level' => $this->normalizeLevel((string) ($entry['level'] ?? 'info')),
                'message' => (string) ($entry['message'] ?? ''),
                'resource' => $entry['resource'] ?? $entry['dataset'] ?? '',
                'metadata' => json_encode($this->metadata($entry)),
                'occurred_at' => $occurredAt->format('Y-m-d H:i:s.v'),
                'created_at' => $now->format('Y-m-d H:i:s.v'),
            ]);
        }

        if ($rows === []) {
            return 0;
        }

        $this->query(
            'INSERT INTO '.$this->table().' FORMAT JSONEachRow'."\n".implode("\n", $rows),
            false,
        );

        return count($rows);
    }

    public function search(Team $team, array $filters = []): LengthAwarePaginator
    {
        $perPage = max(10, min(100, (int) (($filters['perPage'] ?? null) ?: 25)));
        $page = max(1, (int) request()->query('page', 1));
        $offset = ($page - 1) * $perPage;
        $where = $this->whereClause($team, $filters);

        $count = (int) (($this->query('SELECT count() AS aggregate FROM '.$this->table().' '.$where)['data'][0]['aggregate'] ?? 0));

        $result = $this->query(
            'SELECT id, level, message, nullIf(resource, \'\') AS resource, metadata, occurred_at, created_at '.
            'FROM '.$this->table().' '.$where.
            ' ORDER BY occurred_at DESC, id DESC LIMIT '.$perPage.' OFFSET '.$offset
        );

        $items = collect($result['data'] ?? [])->map(fn (array $row) => $this->formatClickHouseRow($row));

        return new Paginator($items, $count, $perPage, $page, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]);
    }

    public function summary(Team $team): array
    {
        $teamId = (int) $team->id;
        $lastDay = now()->subDay()->format('Y-m-d H:i:s.v');
        $table = $this->table();

        $totals = $this->query(
            "SELECT count() AS total,
                countIf(occurred_at >= toDateTime64('{$lastDay}', 3)) AS last24h,
                countIf(level IN ('error', 'fatal') AND occurred_at >= toDateTime64('{$lastDay}', 3)) AS errors24h,
                countIf(level IN ('warn', 'warning') AND occurred_at >= toDateTime64('{$lastDay}', 3)) AS warnings24h
            FROM {$table}
            WHERE team_id = {$teamId}"
        )['data'][0] ?? [];

        $levelRows = $this->query("SELECT level, count() AS aggregate FROM {$table} WHERE team_id = {$teamId} GROUP BY level")['data'] ?? [];
        $resourceRows = $this->query(
            "SELECT resource, count() AS aggregate FROM {$table}
            WHERE team_id = {$teamId} AND resource != ''
            GROUP BY resource ORDER BY aggregate DESC LIMIT 8"
        )['data'] ?? [];

        return [
            'driver' => 'clickhouse',
            'total' => (int) ($totals['total'] ?? 0),
            'last24h' => (int) ($totals['last24h'] ?? 0),
            'errors24h' => (int) ($totals['errors24h'] ?? 0),
            'warnings24h' => (int) ($totals['warnings24h'] ?? 0),
            'levels' => collect($levelRows)->mapWithKeys(fn ($row) => [
                $this->normalizeLevel((string) $row['level']) => (int) $row['aggregate'],
            ])->all(),
            'resources' => collect($resourceRows)->map(fn ($row) => [
                'resource' => $row['resource'],
                'count' => (int) $row['aggregate'],
            ])->all(),
            'rateBuckets' => $this->rateBuckets($team),
        ];
    }

    public function recent(Team $team, int $limit = 10): array
    {
        $teamId = (int) $team->id;
        $limit = max(1, min(50, $limit));

        $result = $this->query(
            'SELECT id, level, message, nullIf(resource, \'\') AS resource, metadata, occurred_at, created_at '.
            'FROM '.$this->table()." WHERE team_id = {$teamId} ORDER BY occurred_at DESC, id DESC LIMIT {$limit}"
        );

        return collect($result['data'] ?? [])->map(fn (array $row) => $this->formatClickHouseRow($row))->all();
    }

    private function query(string $sql, bool $json = true): array
    {
        if ($json && ! str_contains(strtoupper($sql), 'FORMAT JSON')) {
            $sql .= ' FORMAT JSON';
        }

        $request = Http::timeout((int) config('fivebucket.logs.clickhouse.timeout', 10))
            ->withBody($sql, 'text/plain');

        if ($username = config('fivebucket.logs.clickhouse.username')) {
            $request = $request->withBasicAuth($username, (string) config('fivebucket.logs.clickhouse.password'));
        }

        $response = $request->post(rtrim((string) config('fivebucket.logs.clickhouse.url'), '/'));
        $response->throw();

        return $json ? ($response->json() ?: []) : [];
    }

    private function rateBuckets(Team $team): array
    {
        $teamId = (int) $team->id;
        $start = now()->subMinutes(59)->startOfMinute();
        $table = $this->table();

        $rows = $this->query(
            "SELECT
                formatDateTime(toStartOfMinute(occurred_at), '%Y-%m-%d %H:%i:00') AS minute,
                count() AS total,
                countIf(level = 'debug') AS debug,
                countIf(level = 'info') AS info,
                countIf(level IN ('warn', 'warning')) AS warn,
                countIf(level = 'error') AS error,
                countIf(level = 'fatal') AS fatal
            FROM {$table}
            WHERE team_id = {$teamId}
                AND occurred_at >= toDateTime64(".$this->quote($start->format('Y-m-d H:i:s.v')).", 3)
            GROUP BY minute
            ORDER BY minute ASC"
        )['data'] ?? [];

        $indexed = collect($rows)->keyBy('minute');
        $buckets = [];

        for ($i = 0; $i < 60; $i++) {
            $minute = $start->copy()->addMinutes($i);
            $key = $minute->format('Y-m-d H:i:00');
            $row = $indexed->get($key, []);
            $warn = (int) ($row['warn'] ?? 0);
            $error = (int) ($row['error'] ?? 0);
            $fatal = (int) ($row['fatal'] ?? 0);

            $buckets[] = [
                'minute' => $minute->toIso8601String(),
                'label' => $minute->format('H:i'),
                'total' => (int) ($row['total'] ?? 0),
                'debug' => (int) ($row['debug'] ?? 0),
                'info' => (int) ($row['info'] ?? 0),
                'warn' => $warn,
                'error' => $error,
                'fatal' => $fatal,
                'hasWarn' => $warn > 0,
                'hasError' => ($error + $fatal) > 0,
            ];
        }

        return $buckets;
    }

    private function whereClause(Team $team, array $filters): string
    {
        $where = ['team_id = '.((int) $team->id)];

        $q = trim((string) ($filters['q'] ?? ''));
        if ($q !== '') {
            $needle = $this->quote($q);
            $where[] = "(positionCaseInsensitiveUTF8(message, {$needle}) > 0 OR positionCaseInsensitiveUTF8(resource, {$needle}) > 0 OR positionCaseInsensitiveUTF8(metadata, {$needle}) > 0)";
        }

        $level = trim((string) ($filters['level'] ?? ''));
        if ($level !== '' && $level !== 'all') {
            $where[] = 'level = '.$this->quote($this->normalizeLevel($level));
        }

        $resource = trim((string) ($filters['resource'] ?? ''));
        if ($resource !== '') {
            $where[] = 'resource = '.$this->quote($resource);
        }

        if ($from = $this->timestamp($filters['from'] ?? null)) {
            $where[] = 'occurred_at >= toDateTime64('.$this->quote($from->format('Y-m-d H:i:s.v')).', 3)';
        }

        if ($to = $this->timestamp($filters['to'] ?? null)) {
            $where[] = 'occurred_at <= toDateTime64('.$this->quote($to->format('Y-m-d H:i:s.v')).', 3)';
        }

        return 'WHERE '.implode(' AND ', $where);
    }

    private function table(): string
    {
        $database = trim((string) config('fivebucket.logs.clickhouse.database'));
        $table = trim((string) config('fivebucket.logs.clickhouse.table', 'fivebucket_logs'));

        return ($database !== '' ? $this->identifier($database).'.' : '').$this->identifier($table);
    }

    private function identifier(string $identifier): string
    {
        return '`'.str_replace('`', '``', $identifier).'`';
    }

    private function quote(string $value): string
    {
        return "'".str_replace("'", "''", $value)."'";
    }

    private function metadata(array $entry): array
    {
        $metadata = is_array($entry['metadata'] ?? null) ? $entry['metadata'] : [];

        foreach (['dataset', 'source', 'server', 'player', 'playerSource', 'tags', 'fields'] as $key) {
            if (array_key_exists($key, $entry) && ! array_key_exists($key, $metadata)) {
                $metadata[$key] = $entry[$key];
            }
        }

        return $metadata;
    }

    private function timestamp(mixed $value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
