<?php

namespace App\Http\Controllers;

use App\Services\Logs\LogStorage;
use App\Services\TeamProvisioner;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

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
            'level' => trim((string) $request->query('level', 'all')),
            'resource' => trim((string) $request->query('resource', '')),
            'from' => trim((string) $request->query('from', '')),
            'to' => trim((string) $request->query('to', '')),
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
}
