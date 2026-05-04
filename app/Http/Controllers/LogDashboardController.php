<?php

namespace App\Http\Controllers;

use App\Services\Logs\LogStorage;
use App\Services\TeamProvisioner;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LogDashboardController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly LogStorage $logs,
    )
    {
    }

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'qMode' => trim((string) $request->query('qMode', 'all')),
            'level' => trim((string) $request->query('level', 'all')),
            'levels' => $this->levels($request->query('levels', $request->query('level', 'all'))),
            'resource' => trim((string) $request->query('resource', '')),
            'resourceMode' => trim((string) $request->query('resourceMode', 'exact')),
            'requestId' => trim((string) $request->query('requestId', '')),
            'server' => trim((string) $request->query('server', '')),
            'player' => trim((string) $request->query('player', '')),
            'ip' => trim((string) $request->query('ip', '')),
            'metadataKey' => trim((string) $request->query('metadataKey', '')),
            'metadataValue' => trim((string) $request->query('metadataValue', '')),
            'durationMin' => trim((string) $request->query('durationMin', '')),
            'durationMax' => trim((string) $request->query('durationMax', '')),
            'from' => trim((string) $request->query('from', '')),
            'to' => trim((string) $request->query('to', '')),
            'timeframe' => trim((string) $request->query('timeframe', '')),
            'sort' => trim((string) $request->query('sort', 'newest')),
            'perPage' => (int) $request->query('perPage', 25),
        ];

        $summary = $this->logs->summary($team);
        $entries = $this->logs->search($team, $filters);

        return Inertia::render('Logs/Index', [
            'team' => [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
            ],
            'filters' => $filters,
            'summary' => $summary,
            'logs' => [
                'data' => $entries->items(),
                'links' => $entries->linkCollection(),
                'meta' => [
                    'currentPage' => $entries->currentPage(),
                    'from' => $entries->firstItem(),
                    'lastPage' => $entries->lastPage(),
                    'perPage' => $entries->perPage(),
                    'to' => $entries->lastItem(),
                    'total' => $entries->total(),
                ],
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'qMode' => trim((string) $request->query('qMode', 'all')),
            'level' => trim((string) $request->query('level', 'all')),
            'levels' => $this->levels($request->query('levels', $request->query('level', 'all'))),
            'resource' => trim((string) $request->query('resource', '')),
            'resourceMode' => trim((string) $request->query('resourceMode', 'exact')),
            'requestId' => trim((string) $request->query('requestId', '')),
            'server' => trim((string) $request->query('server', '')),
            'player' => trim((string) $request->query('player', '')),
            'ip' => trim((string) $request->query('ip', '')),
            'metadataKey' => trim((string) $request->query('metadataKey', '')),
            'metadataValue' => trim((string) $request->query('metadataValue', '')),
            'durationMin' => trim((string) $request->query('durationMin', '')),
            'durationMax' => trim((string) $request->query('durationMax', '')),
            'from' => trim((string) $request->query('from', '')),
            'to' => trim((string) $request->query('to', '')),
            'timeframe' => trim((string) $request->query('timeframe', '')),
            'sort' => trim((string) $request->query('sort', 'newest')),
        ];
        $format = strtolower(trim((string) $request->query('format', 'csv')));
        $rows = $this->logs->export($team, $filters, 10000);
        $filename = 'fivebucket-logs-'.now()->format('Ymd-His').'.'.($format === 'json' ? 'json' : 'csv');

        if ($format === 'json') {
            return response()->streamDownload(function () use ($rows): void {
                echo json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            }, $filename, ['Content-Type' => 'application/json']);
        }

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['id', 'level', 'occurred_at', 'resource', 'message', 'metadata']);

            foreach ($rows as $row) {
                fputcsv($output, [
                    $row['id'] ?? '',
                    $row['level'] ?? '',
                    $row['occurredAtIso'] ?? '',
                    $row['resource'] ?? '',
                    $row['message'] ?? '',
                    json_encode($row['metadata'] ?? [], JSON_UNESCAPED_SLASHES),
                ]);
            }

            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function levels(mixed $value): array
    {
        if (is_array($value)) {
            $levels = $value;
        } else {
            $levels = preg_split('/[,|]/', (string) $value) ?: [];
        }

        $levels = collect($levels)
            ->map(fn ($level) => strtolower(trim((string) $level)))
            ->map(fn ($level) => $level === 'warning' ? 'warn' : $level)
            ->filter(fn ($level) => in_array($level, ['debug', 'info', 'warn', 'error', 'fatal'], true))
            ->values()
            ->unique()
            ->all();

        return $levels === [] ? ['all'] : $levels;
    }
}
