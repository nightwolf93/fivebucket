<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveApiToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ?string $scope = null): Response
    {
        $plainText = $this->plainTextToken($request);

        if (! $plainText) {
            return response()->json([
                'status' => 'error',
                'message' => 'Missing API key.',
            ], 401);
        }

        $token = ApiToken::findActiveByPlainText($plainText);

        if (! $token) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid API key.',
            ], 401);
        }

        if ($scope && ! $token->allows($scope)) {
            return response()->json([
                'status' => 'error',
                'message' => 'API key does not have the required scope.',
            ], 403);
        }

        $token->forceFill(['last_used_at' => now()])->save();
        $request->attributes->set('fivebucket_api_token', $token);
        $request->attributes->set('fivebucket_team', $token->team);

        return $next($request);
    }

    private function plainTextToken(Request $request): ?string
    {
        $header = $request->header('Authorization');

        if ($header) {
            return preg_replace('/^Bearer\s+/i', '', trim($header));
        }

        $queryToken = $request->query('apiKey');

        return is_string($queryToken) && $queryToken !== '' ? $queryToken : null;
    }
}
