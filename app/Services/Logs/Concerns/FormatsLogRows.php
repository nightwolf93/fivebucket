<?php

namespace App\Services\Logs\Concerns;

use App\Models\LogEntry;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

trait FormatsLogRows
{
    protected function formatDatabaseRow(LogEntry $log): array
    {
        return [
            'id' => (string) $log->id,
            'level' => $this->normalizeLevel($log->level),
            'message' => $log->message,
            'resource' => $log->resource,
            'metadata' => $log->metadata ?? [],
            'occurredAt' => $this->humanTime($log->occurred_at ?? $log->created_at),
            'occurredAtIso' => ($log->occurred_at ?? $log->created_at)?->toIso8601String(),
            'createdAt' => $this->humanTime($log->created_at),
        ];
    }

    protected function formatClickHouseRow(array $row): array
    {
        $metadata = $row['metadata'] ?? [];

        if (is_string($metadata)) {
            $metadata = json_decode($metadata, true) ?: [];
        }

        $occurredAt = $this->parseDate($row['occurred_at'] ?? $row['created_at'] ?? null);
        $createdAt = $this->parseDate($row['created_at'] ?? null);

        return [
            'id' => (string) ($row['id'] ?? ''),
            'level' => $this->normalizeLevel((string) ($row['level'] ?? 'info')),
            'message' => (string) ($row['message'] ?? ''),
            'resource' => $row['resource'] ?: null,
            'metadata' => is_array($metadata) ? $metadata : [],
            'occurredAt' => $this->humanTime($occurredAt),
            'occurredAtIso' => $occurredAt?->toIso8601String(),
            'createdAt' => $this->humanTime($createdAt),
        ];
    }

    protected function normalizeLevel(string $level): string
    {
        $level = strtolower(trim($level));

        return match ($level) {
            'warning' => 'warn',
            'err' => 'error',
            'fatal', 'critical' => 'fatal',
            default => $level ?: 'info',
        };
    }

    protected function humanTime(?CarbonInterface $date): ?string
    {
        return $date?->diffForHumans();
    }

    protected function parseDate(mixed $value): ?Carbon
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
