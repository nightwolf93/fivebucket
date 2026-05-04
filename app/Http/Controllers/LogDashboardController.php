<?php

namespace App\Http\Controllers;

use App\Services\Logs\LogStorage;
use App\Services\TeamProvisioner;
use Illuminate\Http\JsonResponse;
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
        $filters = $this->filtersFromRequest($request);

        $summary = $this->logs->summary($team);
        $entries = $this->logs->search($team, $filters);
        $savedViews = $team->logSavedViews()
            ->orderByDesc('pinned')
            ->orderBy('sort_order')
            ->latest()
            ->get()
            ->map(fn ($view) => [
                'id' => $view->id,
                'name' => $view->name,
                'filters' => $view->filters,
                'pinned' => $view->pinned,
            ]);

        return Inertia::render('Logs/Index', [
            'team' => [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
            ],
            'filters' => $filters,
            'savedViews' => $savedViews,
            'logSavedViews' => $savedViews,
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
        $filters = $this->filtersFromRequest($request);
        $format = strtolower(trim((string) $request->query('format', 'csv')));
        $metadataColumns = $this->metadataColumns($request->query('metadataColumns', $request->query('columns', '')));
        $rows = $this->logs->export($team, $filters, 10000);
        $filename = 'fivebucket-logs-'.now()->format('Ymd-His').'.'.($format === 'json' ? 'json' : 'csv');

        if ($format === 'json') {
            return response()->streamDownload(function () use ($rows, $metadataColumns): void {
                echo json_encode($this->projectRows($rows, $metadataColumns), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            }, $filename, ['Content-Type' => 'application/json']);
        }

        return response()->streamDownload(function () use ($rows, $metadataColumns): void {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['id', 'level', 'occurred_at', 'resource', 'message', ...array_map(fn ($path) => 'metadata.'.$path, $metadataColumns), 'metadata']);

            foreach ($rows as $row) {
                fputcsv($output, [
                    $row['id'] ?? '',
                    $row['level'] ?? '',
                    $row['occurredAtIso'] ?? '',
                    $row['resource'] ?? '',
                    $row['message'] ?? '',
                    ...array_map(fn ($path) => $this->metadataValue($row['metadata'] ?? [], $path), $metadataColumns),
                    json_encode($row['metadata'] ?? [], JSON_UNESCAPED_SLASHES),
                ]);
            }

            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function metadataSuggestions(Request $request): JsonResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $filters = $this->filtersFromRequest($request);

        return response()->json([
            'status' => 'ok',
            ...$this->logs->metadataSuggestions(
                $team,
                $filters,
                trim((string) $request->query('key', '')) ?: null,
            ),
        ]);
    }

    private function filtersFromRequest(Request $request): array
    {
        return [
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
            'metadataMode' => $this->metadataMode($request->query('metadataMode', 'contains')),
            'metadataFilters' => $this->metadataFilters($request->query('metadataFilters', [])),
            'durationMin' => trim((string) $request->query('durationMin', '')),
            'durationMax' => trim((string) $request->query('durationMax', '')),
            'from' => trim((string) $request->query('from', '')),
            'to' => trim((string) $request->query('to', '')),
            'timeframe' => trim((string) $request->query('timeframe', '')),
            'sort' => trim((string) $request->query('sort', 'newest')),
            'perPage' => (int) $request->query('perPage', 25),
            'metadataColumns' => $this->metadataColumns($request->query('metadataColumns', '')),
        ];
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

    private function metadataMode(mixed $value): string
    {
        $mode = strtolower(trim((string) $value));

        return in_array($mode, ['contains', 'exact', 'exists', 'missing', 'ne', 'gt', 'gte', 'lt', 'lte'], true) ? $mode : 'contains';
    }

    private function metadataFilters(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true) ?: [];
        }

        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(function ($filter): ?array {
                if (! is_array($filter)) {
                    return null;
                }

                $key = trim((string) ($filter['key'] ?? ''));
                if ($key === '' || strlen($key) > 160 || ! preg_match('/^[A-Za-z0-9_.-]+$/', $key)) {
                    return null;
                }

                return [
                    'key' => $key,
                    'operator' => $this->metadataMode($filter['operator'] ?? 'contains'),
                    'value' => trim((string) ($filter['value'] ?? '')),
                ];
            })
            ->filter()
            ->values()
            ->take(12)
            ->all();
    }

    private function metadataColumns(mixed $value): array
    {
        if (is_array($value)) {
            $items = $value;
        } else {
            $items = preg_split('/[,|]/', (string) $value) ?: [];
        }

        return collect($items)
            ->map(fn ($path) => trim((string) $path))
            ->filter(fn ($path) => $path !== '' && strlen($path) <= 160 && preg_match('/^[A-Za-z0-9_.-]+$/', $path))
            ->unique()
            ->values()
            ->take(24)
            ->all();
    }

    private function projectRows(array $rows, array $metadataColumns): array
    {
        if ($metadataColumns === []) {
            return $rows;
        }

        return collect($rows)->map(function (array $row) use ($metadataColumns) {
            $projected = [
                'id' => $row['id'] ?? '',
                'level' => $row['level'] ?? '',
                'occurred_at' => $row['occurredAtIso'] ?? '',
                'resource' => $row['resource'] ?? '',
                'message' => $row['message'] ?? '',
            ];

            foreach ($metadataColumns as $path) {
                $projected['metadata.'.$path] = $this->metadataValue($row['metadata'] ?? [], $path);
            }

            $projected['metadata'] = $row['metadata'] ?? [];

            return $projected;
        })->all();
    }

    private function metadataValue(array $metadata, string $path): mixed
    {
        $value = $metadata;

        foreach (array_filter(explode('.', $path), fn ($segment) => $segment !== '') as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return '';
            }

            $value = $value[$segment];
        }

        return is_array($value) ? json_encode($value, JSON_UNESCAPED_SLASHES) : $value;
    }
}
