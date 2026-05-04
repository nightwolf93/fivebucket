<?php

namespace App\Http\Controllers;

use App\Models\SdkAction;
use App\Models\SdkActionExecution;
use App\Models\SdkSession;
use App\Services\Sdk\RemoteActionRegistry;
use App\Services\Sdk\RemoteActionValidationException;
use App\Services\TeamProvisioner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RemoteActionController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly RemoteActionRegistry $registry,
    ) {}

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $this->expireStaleExecutions($team->id);

        $sessions = $team->sdkSessions()
            ->with(['actions' => fn ($query) => $query->where('enabled', true)->orderBy('category')->orderBy('label')])
            ->whereNull('invalidated_at')
            ->where('expires_at', '>', now())
            ->orderByDesc('last_seen_at')
            ->get();

        $executions = $team->sdkActionExecutions()
            ->with(['sdkSession', 'requester'])
            ->latest()
            ->limit(50)
            ->get();

        return Inertia::render('Actions/Index', [
            'team' => [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
            ],
            'sessions' => $sessions->map(fn (SdkSession $session) => [
                'id' => $session->id,
                'sdkType' => $session->sdk_type,
                'endpoint' => $session->endpoint,
                'resourceName' => $session->resource_name,
                'universeId' => $session->universe_id,
                'jobId' => $session->job_id,
                'online' => $session->isOnline(),
                'lastSeenAt' => $session->last_seen_at?->diffForHumans(),
                'expiresAt' => $session->expires_at?->toISOString(),
                'actions' => $session->actions->map(fn (SdkAction $action) => $this->actionPayload($action))->values(),
            ]),
            'executions' => $executions->map(fn (SdkActionExecution $execution) => $this->executionPayload($execution)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $validated = $request->validate([
            'sdk_session_id' => ['required', 'integer'],
            'action_key' => ['required', 'string', 'max:120'],
            'params' => ['nullable', 'array'],
            'confirm' => ['nullable', 'boolean'],
        ]);

        $session = $team->sdkSessions()
            ->whereKey($validated['sdk_session_id'])
            ->whereNull('invalidated_at')
            ->where('expires_at', '>', now())
            ->firstOrFail();

        $action = $session->actions()
            ->where('team_id', $team->id)
            ->where('action_key', $validated['action_key'])
            ->where('enabled', true)
            ->firstOrFail();

        if ($action->requires_confirmation && ! ($validated['confirm'] ?? false)) {
            return back()->with('error', 'This action requires confirmation.');
        }

        try {
            $params = $this->registry->normalizeParams($validated['params'] ?? [], $action->schema ?? []);
        } catch (RemoteActionValidationException $exception) {
            return back()->withErrors(collect($exception->errors)->mapWithKeys(fn ($message, $key) => ["params.{$key}" => $message])->all())->withInput();
        }

        $timeout = max(5, min(600, (int) $action->timeout_seconds));

        SdkActionExecution::create([
            'team_id' => $team->id,
            'sdk_session_id' => $session->id,
            'sdk_action_id' => $action->id,
            'requested_by' => $request->user()->id,
            'action_key' => $action->action_key,
            'action_label' => $action->label,
            'params' => $params,
            'status' => SdkActionExecution::STATUS_QUEUED,
            'requested_at' => now(),
            'expires_at' => now()->addSeconds($timeout + 60),
        ]);

        return back()->with('success', 'Remote action queued. The SDK will pick it up on its next poll.');
    }

    public function cancel(Request $request, SdkActionExecution $execution): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($execution->team_id === $team->id, 404);

        if (in_array($execution->status, [SdkActionExecution::STATUS_QUEUED, SdkActionExecution::STATUS_DELIVERED], true)) {
            $execution->forceFill([
                'status' => SdkActionExecution::STATUS_CANCELLED,
                'error' => 'Cancelled from dashboard.',
                'completed_at' => now(),
            ])->save();

            return back()->with('success', 'Remote action cancelled.');
        }

        return back()->with('error', 'Only queued or delivered actions can be cancelled.');
    }

    private function actionPayload(SdkAction $action): array
    {
        return [
            'id' => $action->id,
            'key' => $action->action_key,
            'label' => $action->label,
            'description' => $action->description,
            'category' => $action->category ?: 'General',
            'schema' => ['fields' => $this->registry->fields($action->schema ?? [])],
            'dangerous' => $action->dangerous,
            'requiresConfirmation' => $action->requires_confirmation,
            'timeoutSeconds' => $action->timeout_seconds,
            'lastSeenAt' => $action->last_seen_at?->diffForHumans(),
        ];
    }

    private function executionPayload(SdkActionExecution $execution): array
    {
        return [
            'id' => $execution->id,
            'actionKey' => $execution->action_key,
            'actionLabel' => $execution->action_label ?: $execution->action_key,
            'params' => $execution->params ?? [],
            'status' => $execution->status,
            'result' => $execution->result ?? [],
            'error' => $execution->error,
            'requestedBy' => $execution->requester?->name,
            'server' => [
                'resourceName' => $execution->sdkSession?->resource_name,
                'endpoint' => $execution->sdkSession?->endpoint,
            ],
            'requestedAt' => $execution->requested_at?->diffForHumans(),
            'deliveredAt' => $execution->delivered_at?->diffForHumans(),
            'startedAt' => $execution->started_at?->diffForHumans(),
            'completedAt' => $execution->completed_at?->diffForHumans(),
            'expiresAt' => $execution->expires_at?->toISOString(),
        ];
    }

    private function expireStaleExecutions(int $teamId): void
    {
        SdkActionExecution::query()
            ->where('team_id', $teamId)
            ->whereIn('status', [
                SdkActionExecution::STATUS_QUEUED,
                SdkActionExecution::STATUS_DELIVERED,
                SdkActionExecution::STATUS_RUNNING,
            ])
            ->where('expires_at', '<=', now())
            ->update([
                'status' => SdkActionExecution::STATUS_TIMEOUT,
                'error' => 'Execution expired before the SDK returned a result.',
                'completed_at' => now(),
            ]);
    }
}
