<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\SdkSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SdkController extends Controller
{
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

        SdkSession::create([
            'team_id' => $apiToken->team_id,
            'api_token_id' => $apiToken->id,
            'token_hash' => hash('sha256', $plainToken),
            'sdk_type' => $sdkType,
            'endpoint' => $request->query('endpoint'),
            'resource_name' => $request->query('resourceName'),
            'universe_id' => $request->query('universeId'),
            'job_id' => $request->query('jobId'),
            'expires_at' => $expiresAt,
        ]);

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
        $session->forceFill(['expires_at' => $expiresAt])->save();

        return response()->json([
            'expiresAt' => $expiresAt->toISOString(),
            'message' => 'Heartbeat received',
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

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $message,
        ], $status);
    }
}
