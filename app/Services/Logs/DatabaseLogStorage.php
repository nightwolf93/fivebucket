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

        return $query
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (LogEntry $log) => $this->formatDatabaseRow($log));
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
            $query->where(function (Builder $query) use ($q) {
                $query->where('message', 'like', "%{$q}%")
                    ->orWhere('resource', 'like', "%{$q}%")
                    ->orWhere('metadata', 'like', "%{$q}%");
            });
        }

        $level = trim((string) ($filters['level'] ?? ''));
        if ($level !== '' && $level !== 'all') {
            $query->where('level', $this->normalizeLevel($level));
        }

        $resource = trim((string) ($filters['resource'] ?? ''));
        if ($resource !== '') {
            $query->where('resource', $resource);
        }

        if ($from = $this->timestamp($filters['from'] ?? null)) {
            $query->where('occurred_at', '>=', $from);
        }

        if ($to = $this->timestamp($filters['to'] ?? null)) {
            $query->where('occurred_at', '<=', $to);
        }
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

    private function perPage(mixed $value): int
    {
        return max(10, min(100, (int) ($value ?: 25)));
    }
}
