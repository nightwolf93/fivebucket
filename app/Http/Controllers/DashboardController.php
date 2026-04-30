<?php

namespace App\Http\Controllers;

use App\Services\TeamProvisioner;
use App\Services\Logs\LogStorage;
use App\Support\ByteFormatter;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly LogStorage $logs,
    )
    {
    }

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user())->load('plan');
        $limit = max($team->storage_limit_bytes, 1);
        $logSummary = $this->logs->summary($team);

        return Inertia::render('Dashboard', [
            'team' => [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'billingStatus' => $team->billing_status,
                'storageUsedBytes' => $team->storage_used_bytes,
                'storageLimitBytes' => $team->storage_limit_bytes,
                'storageUsed' => ByteFormatter::human($team->storage_used_bytes),
                'storageLimit' => ByteFormatter::human($team->storage_limit_bytes),
                'storagePercent' => round(($team->storage_used_bytes / $limit) * 100, 1),
                'plan' => $team->plan?->only(['name', 'slug']),
                'publicBaseUrl' => $team->effectivePublicBaseUrl(),
            ],
            'stats' => [
                'activeApiKeys' => $team->apiTokens()->whereNull('revoked_at')->count(),
                'totalMedia' => $team->mediaFiles()->count(),
                'images' => $team->mediaFiles()->where('type', 'image')->count(),
                'videos' => $team->mediaFiles()->where('type', 'video')->count(),
                'audio' => $team->mediaFiles()->where('type', 'audio')->count(),
                'logs24h' => $logSummary['last24h'],
                'logsTotal' => $logSummary['total'],
            ],
            'files' => $team->mediaFiles()
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn ($file) => [
                    'id' => $file->public_id,
                    'filename' => $file->filename,
                    'type' => $file->type,
                    'size' => ByteFormatter::human($file->size_bytes),
                    'url' => $file->deliveryUrl($team),
                    'createdAt' => $file->created_at?->diffForHumans(),
                ]),
            'logs' => $this->logs->recent($team, 10),
        ]);
    }
}
