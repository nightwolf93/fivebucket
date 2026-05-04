<?php

namespace App\Services\Logs;

class LogFilterMatcher
{
    public function matches(array $log, array $filters): bool
    {
        $metadata = is_array($log['metadata'] ?? null) ? $log['metadata'] : [];
        $level = $this->normalizeLevel((string) ($log['level'] ?? 'info'));
        $levels = $this->levels($filters);

        if ($levels !== [] && ! in_array($level, $levels, true)) {
            return false;
        }

        $resource = trim((string) ($filters['resource'] ?? ''));
        if ($resource !== '') {
            $actual = (string) ($log['resource'] ?? '');

            if (($filters['resourceMode'] ?? 'exact') === 'contains') {
                if (! str_contains(strtolower($actual), strtolower($resource))) {
                    return false;
                }
            } elseif ($actual !== $resource) {
                return false;
            }
        }

        if (! $this->matchesSearch($log, $metadata, $filters)) {
            return false;
        }

        foreach ([
            'requestId' => ['request_id', 'requestId', 'request.id', 'trace_id', 'traceId'],
            'server' => ['server_id', 'server', 'source'],
            'player' => ['player_id', 'player', 'playerSource', 'player.source', 'player.id', 'charId', 'charName'],
            'ip' => ['ip', 'player.ip'],
        ] as $filter => $keys) {
            $value = trim((string) ($filters[$filter] ?? ''));

            if ($value !== '' && ! $this->metadataValueIncludes($metadata, $keys, $value)) {
                return false;
            }
        }

        foreach ($this->metadataFilters($filters) as $condition) {
            if (! $this->metadataConditionMatches($metadata, $condition)) {
                return false;
            }
        }

        return true;
    }

    private function matchesSearch(array $log, array $metadata, array $filters): bool
    {
        $q = strtolower(trim((string) ($filters['q'] ?? '')));

        if ($q === '') {
            return true;
        }

        $metadataText = strtolower(json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '');
        $message = strtolower((string) ($log['message'] ?? ''));
        $resource = strtolower((string) ($log['resource'] ?? ''));
        $haystack = match ((string) ($filters['qMode'] ?? 'all')) {
            'message' => $message,
            'resource' => $resource,
            'metadata' => $metadataText,
            default => $message.' '.$resource.' '.$metadataText,
        };

        return str_contains($haystack, $q);
    }

    private function metadataValueIncludes(array $metadata, array $keys, string $needle): bool
    {
        $needle = strtolower($needle);

        foreach ($keys as $key) {
            $value = $this->metadataPath($metadata, $key);

            if ($value !== null && str_contains(strtolower((string) $value), $needle)) {
                return true;
            }
        }

        return false;
    }

    private function metadataConditionMatches(array $metadata, array $condition): bool
    {
        $value = $this->metadataPath($metadata, $condition['key']);
        $exists = $value !== null;
        $expected = (string) ($condition['value'] ?? '');

        if ($condition['operator'] === 'missing') {
            return ! $exists;
        }

        if (! $exists) {
            return false;
        }

        if ($condition['operator'] === 'exists' || $expected === '') {
            return true;
        }

        if ($condition['operator'] === 'exact') {
            return (string) $value === $expected;
        }

        if ($condition['operator'] === 'ne') {
            return (string) $value !== $expected;
        }

        if (in_array($condition['operator'], ['gt', 'gte', 'lt', 'lte'], true)) {
            if (! is_numeric($value) || ! is_numeric($expected)) {
                return false;
            }

            $actual = (float) $value;
            $target = (float) $expected;

            return match ($condition['operator']) {
                'gt' => $actual > $target,
                'gte' => $actual >= $target,
                'lt' => $actual < $target,
                'lte' => $actual <= $target,
            };
        }

        return str_contains(strtolower((string) $value), strtolower($expected));
    }

    private function metadataFilters(array $filters): array
    {
        $items = $filters['metadataFilters'] ?? [];

        if (is_string($items)) {
            $items = json_decode($items, true) ?: [];
        }

        $conditions = collect(is_array($items) ? $items : [])
            ->map(function ($item): ?array {
                if (! is_array($item)) {
                    return null;
                }

                $key = trim((string) ($item['key'] ?? ''));
                if ($key === '' || ! preg_match('/^[A-Za-z0-9_.-]+$/', $key)) {
                    return null;
                }

                $operator = strtolower(trim((string) ($item['operator'] ?? $item['mode'] ?? 'contains')));
                if (! in_array($operator, ['contains', 'exact', 'exists', 'missing', 'ne', 'gt', 'gte', 'lt', 'lte'], true)) {
                    $operator = 'contains';
                }

                return [
                    'key' => $key,
                    'operator' => $operator,
                    'value' => trim((string) ($item['value'] ?? '')),
                ];
            })
            ->filter()
            ->values()
            ->all();

        if ($conditions !== []) {
            return $conditions;
        }

        $metadataKey = trim((string) ($filters['metadataKey'] ?? ''));
        if ($metadataKey === '') {
            return [];
        }

        return [[
            'key' => $metadataKey,
            'operator' => strtolower(trim((string) ($filters['metadataMode'] ?? 'contains'))) ?: 'contains',
            'value' => trim((string) ($filters['metadataValue'] ?? '')),
        ]];
    }

    private function metadataPath(array $metadata, string $path): mixed
    {
        $value = $metadata;

        foreach (array_filter(explode('.', $path), fn ($segment) => $segment !== '') as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return null;
            }

            $value = $value[$segment];
        }

        return $value;
    }

    private function levels(array $filters): array
    {
        $value = $filters['levels'] ?? $filters['level'] ?? '';
        $levels = is_array($value) ? $value : preg_split('/[,|]/', (string) $value);

        return collect($levels ?: [])
            ->map(fn ($level) => $this->normalizeLevel((string) $level))
            ->filter(fn ($level) => in_array($level, ['debug', 'info', 'warn', 'error', 'fatal'], true))
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeLevel(string $level): string
    {
        $level = strtolower(trim($level));

        return match ($level) {
            'warning' => 'warn',
            'err' => 'error',
            'fatal', 'critical' => 'fatal',
            default => $level ?: 'info',
        };
    }
}
