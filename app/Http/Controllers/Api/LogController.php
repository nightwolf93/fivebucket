<?php

namespace App\Http\Controllers\Api;

use App\Events\LogsIngested;
use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\Team;
use App\Services\Logs\LogStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Throwable;

class LogController extends Controller
{
    public function __construct(private readonly LogStorage $logs)
    {
    }

    public function ingest(Request $request): JsonResponse
    {
        return $this->storeEntries($request);
    }

    public function ingestLegacy(Request $request): JsonResponse
    {
        return $this->storeEntries($request);
    }

    public function ingestDiscord(Request $request): JsonResponse
    {
        try {
            $payload = $request->all();
            $entries = [];

            foreach (($payload['embeds'] ?? []) as $embed) {
                $entries[] = [
                    'level' => 'info',
                    'message' => $embed['title'] ?? $embed['description'] ?? $payload['content'] ?? 'Discord webhook log',
                    'resource' => 'discord',
                    'metadata' => [
                        'discord' => [
                            'username' => $payload['username'] ?? null,
                            'avatar_url' => $payload['avatar_url'] ?? null,
                            'embed' => $embed,
                        ],
                    ],
                    'timestamp' => $embed['timestamp'] ?? null,
                ];
            }

            if ($entries === [] && isset($payload['content'])) {
                $entries[] = [
                    'level' => 'info',
                    'message' => (string) $payload['content'],
                    'resource' => 'discord',
                    'metadata' => ['discord' => $payload],
                ];
            }

            $team = $this->team($request);
            $stored = $this->logs->store($team, $this->apiToken($request), $entries);
            $this->broadcastLogs($team, $entries, $stored);

            return $this->ok();
        } catch (Throwable $exception) {
            report($exception);

            return $this->error('Internal server error.', 500);
        }
    }

    private function storeEntries(Request $request): JsonResponse
    {
        try {
            $payload = $request->json()->all();
            $entries = $payload;

            if ($this->isAssoc($payload)) {
                $entries = [$payload];
            }

            if (! is_array($entries) || $this->isAssoc($entries)) {
                return $this->error('Log payload must be an array of log entries.', 400);
            }

            $team = $this->team($request);
            $stored = $this->logs->store($team, $this->apiToken($request), $entries);
            $this->broadcastLogs($team, $entries, $stored);

            return $this->ok();
        } catch (Throwable $exception) {
            report($exception);

            return $this->error('Internal server error.', 500);
        }
    }

    private function isAssoc(array $value): bool
    {
        if ($value === []) {
            return false;
        }

        return array_keys($value) !== range(0, count($value) - 1);
    }

    private function team(Request $request): Team
    {
        return $request->attributes->get('fivebucket_team');
    }

    private function apiToken(Request $request): ?ApiToken
    {
        return $request->attributes->get('fivebucket_api_token');
    }

    private function ok(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }

    private function broadcastLogs(Team $team, array $entries, int $stored): void
    {
        if ($stored <= 0) {
            return;
        }

        $logs = collect($entries)
            ->filter(fn ($entry) => is_array($entry))
            ->map(fn (array $entry) => $this->broadcastPayload($entry))
            ->values()
            ->all();

        if ($logs === []) {
            return;
        }

        try {
            event(new LogsIngested($team->id, $logs));
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function broadcastPayload(array $entry): array
    {
        $occurredAt = $this->timestamp($entry['timestamp'] ?? $entry['occurred_at'] ?? null) ?? now();

        return [
            'id' => (string) Str::ulid(),
            'level' => $this->normalizeLevel((string) ($entry['level'] ?? 'info')),
            'message' => (string) ($entry['message'] ?? ''),
            'resource' => $entry['resource'] ?? $entry['dataset'] ?? null,
            'metadata' => $this->metadata($entry),
            'occurredAt' => $occurredAt->diffForHumans(),
            'occurredAtIso' => $occurredAt->toIso8601String(),
            'createdAt' => now()->diffForHumans(),
        ];
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
        } catch (Throwable) {
            return null;
        }
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $message,
        ], $status);
    }
}
