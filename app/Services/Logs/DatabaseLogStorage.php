<?php

namespace App\Services\Logs;

use App\Models\ApiToken;
use App\Models\LogEntry;
use App\Models\Team;
use App\Services\Logs\Concerns\FormatsLogRows;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DatabaseLogStorage implements LogStorage
{
    use FormatsLogRows;

    public function store(Team $team, ?ApiToken $token, array $entries): int
    {
        $now = now();
        $rows = [];

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $rows[] = [
                'team_id' => $team->id,
                'api_token_id' => $token?->id,
                'level' => $this->normalizeLevel((string) ($entry['level'] ?? 'info')),
                'message' => (string) ($entry['message'] ?? ''),
                'resource' => $entry['resource'] ?? $entry['dataset'] ?? null,
                'metadata' => json_encode($this->metadata($entry)),
                'occurred_at' => $this->timestamp($entry['timestamp'] ?? $entry['occurred_at'] ?? null) ?? $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($rows === []) {
            return 0;
        }

        LogEntry::query()->insert($rows);

        return count($rows);
    }

    public function search(Team $team, array $filters = []): LengthAwarePaginator
    {
        $query = $team->logEntries();

        $this->applyFilters($query, $filters);

        $perPage = $this->perPage($filters['perPage'] ?? null);

        $this->applySorting($query, $filters);

        return $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (LogEntry $log) => $this->formatDatabaseRow($log));
    }

    public function export(Team $team, array $filters = [], int $limit = 5000): array
    {
        $query = $team->logEntries();

        $this->applyFilters($query, $filters);
        $this->applySorting($query, $filters);

        return $query
            ->limit(max(1, min(10000, $limit)))
            ->get()
            ->map(fn (LogEntry $log) => $this->formatDatabaseRow($log))
            ->all();
    }

    public function summary(Team $team): array
    {
        $lastDay = now()->subDay();

        $levels = $team->logEntries()
            ->select('level', DB::raw('count(*) as aggregate'))
            ->groupBy('level')
            ->pluck('aggregate', 'level')
            ->mapWithKeys(fn ($count, $level) => [$this->normalizeLevel((string) $level) => (int) $count])
            ->all();

        $resources = $team->logEntries()
            ->select('resource', DB::raw('count(*) as aggregate'))
            ->whereNotNull('resource')
            ->groupBy('resource')
            ->orderByDesc('aggregate')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'resource' => $row->resource,
                'count' => (int) $row->aggregate,
            ])
            ->all();

        return [
            'driver' => 'database',
            'total' => $team->logEntries()->count(),
            'last24h' => $team->logEntries()->where('occurred_at', '>=', $lastDay)->count(),
            'errors24h' => $team->logEntries()->whereIn('level', ['error', 'fatal'])->where('occurred_at', '>=', $lastDay)->count(),
            'warnings24h' => $team->logEntries()->whereIn('level', ['warn', 'warning'])->where('occurred_at', '>=', $lastDay)->count(),
            'levels' => $levels,
            'resources' => $resources,
            'rateBuckets' => $this->rateBuckets($team),
        ];
    }

    public function recent(Team $team, int $limit = 10): array
    {
        return $team->logEntries()
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (LogEntry $log) => $this->formatDatabaseRow($log))
            ->all();
    }

    private function applyFilters(Builder|HasMany $query, array $filters): void
    {
        $q = trim((string) ($filters['q'] ?? ''));

        if ($q !== '') {
            $mode = trim((string) ($filters['qMode'] ?? 'all'));

            $query->where(function (Builder $query) use ($q, $mode) {
                if ($mode === 'message') {
                    $query->where('message', 'like', "%{$q}%");

                    return;
                }

                if ($mode === 'metadata') {
                    $query->where('metadata', 'like', "%{$q}%");

                    return;
                }

                if ($mode === 'resource') {
                    $query->where('resource', 'like', "%{$q}%");

                    return;
                }

                $query->where('message', 'like', "%{$q}%")
                    ->orWhere('resource', 'like', "%{$q}%")
                    ->orWhere('metadata', 'like', "%{$q}%");
            });
        }

        $levels = $this->levels($filters);
        if ($levels !== []) {
            $query->whereIn('level', $levels);
        }

        $resource = trim((string) ($filters['resource'] ?? ''));
        if ($resource !== '') {
            if (($filters['resourceMode'] ?? 'exact') === 'contains') {
                $query->where('resource', 'like', "%{$resource}%");
            } else {
                $query->where('resource', $resource);
            }
        }

        foreach ([
            'requestId' => ['request_id', 'requestId', 'request.id', 'trace_id', 'traceId'],
            'server' => ['server_id', 'server', 'source'],
            'player' => ['player_id', 'player', 'playerSource', 'player.source', 'player.id', 'charId', 'charName'],
            'ip' => ['ip', 'player.ip'],
        ] as $filter => $keys) {
            $value = trim((string) ($filters[$filter] ?? ''));

            if ($value === '') {
                continue;
            }

            $query->where(function (Builder $query) use ($keys, $value): void {
                foreach ($keys as $index => $key) {
                    $this->whereJsonText($query, $key, $value, 'contains', $index === 0 ? 'and' : 'or');
                }
            });
        }

        $metadataKey = $this->metadataKey($filters['metadataKey'] ?? '');
        $metadataValue = trim((string) ($filters['metadataValue'] ?? ''));
        if ($metadataKey !== null) {
            $this->whereJsonText(
                $query,
                $metadataKey,
                $metadataValue,
                $this->metadataMode($filters['metadataMode'] ?? 'contains', $metadataValue === ''),
            );
        }

        if (($durationMin = $this->number($filters['durationMin'] ?? null)) !== null) {
            $this->whereJsonNumber($query, 'duration_ms', '>=', $durationMin);
        }

        if (($durationMax = $this->number($filters['durationMax'] ?? null)) !== null) {
            $this->whereJsonNumber($query, 'duration_ms', '<=', $durationMax);
        }

        if ($from = $this->fromTimestamp($filters)) {
            $query->where('occurred_at', '>=', $from);
        }

        if ($to = $this->timestamp($filters['to'] ?? null)) {
            $query->where('occurred_at', '<=', $to);
        }
    }

    private function applySorting(Builder|HasMany $query, array $filters): void
    {
        match ((string) ($filters['sort'] ?? 'newest')) {
            'oldest' => $query->orderBy('occurred_at')->orderBy('id'),
            'level' => $query->orderBy('level')->orderByDesc('occurred_at')->orderByDesc('id'),
            'resource' => $query->orderBy('resource')->orderByDesc('occurred_at')->orderByDesc('id'),
            default => $query->orderByDesc('occurred_at')->orderByDesc('id'),
        };
    }

    private function rateBuckets(Team $team): array
    {
        $start = now()->subMinutes(59)->startOfMinute();
        $end = now()->endOfMinute();
        $buckets = [];

        for ($i = 0; $i < 60; $i++) {
            $minute = $start->copy()->addMinutes($i);

            $buckets[$i] = [
                'minute' => $minute->toIso8601String(),
                'label' => $minute->format('H:i'),
                'total' => 0,
                'debug' => 0,
                'info' => 0,
                'warn' => 0,
                'error' => 0,
                'fatal' => 0,
                'hasWarn' => false,
                'hasError' => false,
            ];
        }

        $team->logEntries()
            ->whereBetween('occurred_at', [$start, $end])
            ->get(['level', 'occurred_at'])
            ->each(function (LogEntry $log) use (&$buckets, $start): void {
                if (! $log->occurred_at) {
                    return;
                }

                $index = (int) floor($start->diffInSeconds($log->occurred_at->copy()->startOfMinute(), false) / 60);

                if ($index < 0 || $index >= 60) {
                    return;
                }

                $level = $this->normalizeLevel((string) $log->level);
                $level = array_key_exists($level, $buckets[$index]) ? $level : 'info';

                $buckets[$index]['total']++;
                $buckets[$index][$level]++;
                $buckets[$index]['hasWarn'] = $buckets[$index]['hasWarn'] || $level === 'warn';
                $buckets[$index]['hasError'] = $buckets[$index]['hasError'] || in_array($level, ['error', 'fatal'], true);
            });

        return array_values($buckets);
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

    private function fromTimestamp(array $filters): ?Carbon
    {
        if ($from = $this->timestamp($filters['from'] ?? null)) {
            return $from;
        }

        return match ((string) ($filters['timeframe'] ?? '')) {
            '15m' => now()->subMinutes(15),
            '1h' => now()->subHour(),
            '6h' => now()->subHours(6),
            '24h' => now()->subDay(),
            '7d' => now()->subDays(7),
            '30d' => now()->subDays(30),
            default => null,
        };
    }

    private function levels(array $filters): array
    {
        $value = $filters['levels'] ?? $filters['level'] ?? '';
        $levels = is_array($value) ? $value : preg_split('/[,|]/', (string) $value);

        return collect($levels ?: [])
            ->map(fn ($level) => $this->normalizeLevel((string) $level))
            ->filter(fn ($level) => in_array($level, ['debug', 'info', 'warn', 'error', 'fatal'], true))
            ->values()
            ->unique()
            ->all();
    }

    private function metadataKey(mixed $value): ?string
    {
        $key = trim((string) $value);

        if ($key === '' || strlen($key) > 160 || ! preg_match('/^[A-Za-z0-9_.-]+$/', $key)) {
            return null;
        }

        $segments = explode('.', $key);

        foreach ($segments as $segment) {
            if ($segment === '' || strlen($segment) > 80 || ! preg_match('/^[A-Za-z0-9_-]+$/', $segment)) {
                return null;
            }
        }

        return implode('.', $segments);
    }

    private function metadataMode(mixed $value, bool $emptyValue = false): string
    {
        $mode = strtolower(trim((string) $value));

        if (in_array($mode, ['exists', 'missing'], true)) {
            return $mode;
        }

        if ($emptyValue) {
            return 'exists';
        }

        return in_array($mode, ['contains', 'exact'], true) ? $mode : 'contains';
    }

    private function metadataLike(string $key, string $value): string
    {
        return '%"'.$key.'"%'.$value.'%';
    }

    private function number(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    private function whereJsonText(Builder|HasMany $query, string $key, string $value, string $mode = 'contains', string $boolean = 'and'): void
    {
        $driver = DB::connection()->getDriverName();
        $method = $boolean === 'or' ? 'orWhereRaw' : 'whereRaw';
        $jsonPath = $this->jsonPath($key);

        if ($driver === 'sqlite') {
            if ($mode === 'missing') {
                $query->{$method}('json_type(metadata, ?) IS NULL', [$jsonPath]);

                return;
            }

            if ($mode === 'exists' || $value === '') {
                $query->{$method}('json_type(metadata, ?) IS NOT NULL', [$jsonPath]);

                return;
            }

            $operator = $mode === 'exact' ? '=' : 'LIKE';
            $needle = $mode === 'exact' ? $value : "%{$value}%";
            $query->{$method}("CAST(json_extract(metadata, ?) AS TEXT) {$operator} ?", [$jsonPath, $needle]);

            return;
        }

        if ($driver === 'mysql') {
            if ($mode === 'missing') {
                $query->{$method}("JSON_CONTAINS_PATH(metadata, 'one', ?) = 0", [$jsonPath]);

                return;
            }

            if ($mode === 'exists' || $value === '') {
                $query->{$method}("JSON_CONTAINS_PATH(metadata, 'one', ?) = 1", [$jsonPath]);

                return;
            }

            $operator = $mode === 'exact' ? '=' : 'LIKE';
            $needle = $mode === 'exact' ? $value : "%{$value}%";
            $query->{$method}("JSON_UNQUOTE(JSON_EXTRACT(metadata, ?)) {$operator} ?", [$jsonPath, $needle]);

            return;
        }

        $method = $boolean === 'or' ? 'orWhere' : 'where';

        if ($mode === 'missing') {
            $query->{$method}('metadata', 'not like', '%"'.$this->lastMetadataSegment($key).'"%');

            return;
        }

        if ($mode === 'exists' || $value === '') {
            $query->{$method}('metadata', 'like', '%"'.$this->lastMetadataSegment($key).'"%');

            return;
        }

        $query->{$method}('metadata', 'like', $this->metadataLike($this->lastMetadataSegment($key), $value));
    }

    private function jsonPath(string $key): string
    {
        $path = '$';

        foreach (explode('.', $key) as $segment) {
            $path .= ctype_digit($segment) ? '['.$segment.']' : '."'.str_replace('"', '\"', $segment).'"';
        }

        return $path;
    }

    private function lastMetadataSegment(string $key): string
    {
        return collect(explode('.', $key))->last() ?: $key;
    }

    private function whereJsonNumber(Builder|HasMany $query, string $key, string $operator, float $value): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            $query->whereRaw("CAST(json_extract(metadata, '$.\"{$key}\"') AS REAL) {$operator} ?", [$value]);

            return;
        }

        if ($driver === 'mysql') {
            $query->whereRaw("CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.\"{$key}\"')) AS DECIMAL(14,3)) {$operator} ?", [$value]);

            return;
        }

        $query->where('metadata', 'like', '%"'.$key.'"%');
    }

    private function perPage(mixed $value): int
    {
        return max(10, min(250, (int) ($value ?: 25)));
    }
}
