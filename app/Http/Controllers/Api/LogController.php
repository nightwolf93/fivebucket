<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\Team;
use App\Services\Logs\LogStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

            $this->logs->store($this->team($request), $this->apiToken($request), $entries);

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

            $this->logs->store($this->team($request), $this->apiToken($request), $entries);

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

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $message,
        ], $status);
    }
}
