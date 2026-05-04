<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SdkActionExecution;
use App\Models\SdkSession;
use App\Services\Sdk\RemoteActionRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SdkController extends Controller
{
    public function __construct(private readonly RemoteActionRegistry $actions) {}

    public function report(Request $request): JsonResponse
    {
        $apiToken = $request->attributes->get('fivebucket_api_token');
        $sdkType = (string) $request->query('sdkType', 'fivem');

        if (! in_array($sdkType, ['fivem', 'roblox'], true)) {
            return $this->error('sdkType must be fivem or roblox.', 400);
        }

        if ($sdkType === 'fivem' && (! $request->query('endpoint') || ! $request->query('resourceName'))) {
            return $this->error('endpoint and resourceName are required for fivem SDK sessions.', 400);
        }

        $plainToken = 'sdk_'.Str::random(48);
        $expiresAt = now()->addMinutes(30);

        $session = SdkSession::create([
            'team_id' => $apiToken->team_id,
            'api_token_id' => $apiToken->id,
            'token_hash' => hash('sha256', $plainToken),
            'sdk_type' => $sdkType,
            'endpoint' => $request->query('endpoint'),
            'resource_name' => $request->query('resourceName'),
            'universe_id' => $request->query('universeId'),
            'job_id' => $request->query('jobId'),
            'metadata' => $this->metadata($request),
            'expires_at' => $expiresAt,
            'last_seen_at' => now(),
        ]);

        $this->actions->sync($session, $request->has('actions') ? $request->input('actions') : null);

        return response()->json([
            'message' => 'SDK token created',
            'token' => $plainToken,
            'expiresAt' => $expiresAt->toISOString(),
        ]);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $session = $this->sdkSession($request);

        if (! $session) {
            return $this->error('Invalid SDK token.', 401);
        }

        $expiresAt = now()->addMinutes(30);
        $session->forceFill([
            'expires_at' => $expiresAt,
            'last_seen_at' => now(),
            'metadata' => array_merge($session->metadata ?? [], $this->metadata($request)),
        ])->save();

        $this->actions->sync($session, $request->has('actions') ? $request->input('actions') : null);

        return response()->json([
            'expiresAt' => $expiresAt->toISOString(),
            'message' => 'Heartbeat received',
            'pendingActions' => $session->actionExecutions()
                ->where('status', SdkActionExecution::STATUS_QUEUED)
                ->where('expires_at', '>', now())
                ->count(),
        ]);
    }

    public function invalidate(Request $request): JsonResponse
    {
        $session = $this->sdkSession($request, false);

        if (! $session) {
            return $this->error('Invalid SDK token.', 404);
        }

        $session->forceFill(['invalidated_at' => now()])->save();

        return response()->json('SDK resource invalidated.');
    }

    public function pollActions(Request $request): JsonResponse
    {
        $session = $this->sdkSession($request);

        if (! $session) {
            return $this->error('Invalid SDK token.', 401);
        }

        $expiresAt = now()->addMinutes(30);
        $session->forceFill([
            'expires_at' => $expiresAt,
            'last_seen_at' => now(),
            'metadata' => array_merge($session->metadata ?? [], $this->metadata($request)),
        ])->save();

        $this->actions->sync($session, $request->has('actions') ? $request->input('actions') : null);
        $this->expireTimedOutExecutions($session);

        $executions = SdkActionExecution::query()
            ->with('sdkAction')
            ->where('sdk_session_id', $session->id)
            ->where('status', SdkActionExecution::STATUS_QUEUED)
            ->where('expires_at', '>', now())
            ->orderBy('id')
            ->limit(10)
            ->get();

        foreach ($executions as $execution) {
            $execution->forceFill([
                'status' => SdkActionExecution::STATUS_DELIVERED,
                'delivered_at' => now(),
            ])->save();
        }

        return response()->json([
            'status' => 'ok',
            'expiresAt' => $expiresAt->toISOString(),
            'actions' => $executions->map(fn (SdkActionExecution $execution) => [
                'id' => $execution->id,
                'actionKey' => $execution->action_key,
                'label' => $execution->action_label,
                'params' => $execution->params ?? [],
                'timeoutSeconds' => max(5, (int) ($execution->sdkAction?->timeout_seconds ?? 30)),
                'requestedAt' => $execution->requested_at?->toISOString(),
                'expiresAt' => $execution->expires_at?->toISOString(),
            ])->values(),
        ]);
    }

    public function ackAction(Request $request, SdkActionExecution $execution): JsonResponse
    {
        $session = $this->sdkSession($request);

        if (! $session || $execution->sdk_session_id !== $session->id) {
            return $this->error('Invalid SDK token.', 401);
        }

        if (! $execution->isTerminal()) {
            $execution->forceFill([
                'status' => SdkActionExecution::STATUS_RUNNING,
                'started_at' => $execution->started_at ?? now(),
            ])->save();
        }

        return response()->json(['status' => 'ok']);
    }

    public function completeAction(Request $request, SdkActionExecution $execution): JsonResponse
    {
        $session = $this->sdkSession($request);

        if (! $session || $execution->sdk_session_id !== $session->id) {
            return $this->error('Invalid SDK token.', 401);
        }

        $ok = filter_var($request->input('ok', $request->input('success', false)), FILTER_VALIDATE_BOOLEAN);
        $result = $request->input('result', $request->input('data', []));

        if (! is_array($result)) {
            $result = ['value' => $result];
        }

        $execution->forceFill([
            'status' => $ok ? SdkActionExecution::STATUS_SUCCEEDED : SdkActionExecution::STATUS_FAILED,
            'result' => $result,
            'error' => $ok ? null : Str::limit((string) $request->input('error', 'Action failed.'), 4000, ''),
            'started_at' => $execution->started_at ?? now(),
            'completed_at' => now(),
        ])->save();

        return response()->json(['status' => 'ok']);
    }

    private function sdkSession(Request $request, bool $mustBeActive = true): ?SdkSession
    {
        $plainText = preg_replace('/^Bearer\s+/i', '', trim((string) $request->header('Authorization')));

        if ($plainText === '') {
            return null;
        }

        $query = SdkSession::query()->where('token_hash', hash('sha256', $plainText));

        if ($mustBeActive) {
            $query->whereNull('invalidated_at')->where('expires_at', '>', now());
        }

        return $query->first();
    }

    private function expireTimedOutExecutions(SdkSession $session): void
    {
        SdkActionExecution::query()
            ->where('sdk_session_id', $session->id)
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

    private function metadata(Request $request): array
    {
        $metadata = $request->input('metadata', []);

        return is_array($metadata) ? $metadata : [];
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $message,
        ], $status);
    }
}
