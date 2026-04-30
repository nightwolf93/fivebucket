<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use App\Services\TeamProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokenController extends Controller
{
    public function __construct(private readonly TeamProvisioner $teams)
    {
    }

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());

        return Inertia::render('ApiKeys/Index', [
            'team' => [
                'name' => $team->name,
                'slug' => $team->slug,
            ],
            'apiBase' => url('/api/v3'),
            'tokens' => $team->apiTokens()
                ->latest()
                ->get()
                ->map(fn (ApiToken $token) => [
                    'id' => $token->id,
                    'name' => $token->name,
                    'prefix' => $token->prefix,
                    'scopes' => $token->scopes,
                    'lastUsedAt' => $token->last_used_at?->diffForHumans(),
                    'revokedAt' => $token->revoked_at?->diffForHumans(),
                    'createdAt' => $token->created_at?->diffForHumans(),
                    'isActive' => $token->revoked_at === null,
                    'canReveal' => $token->canRevealSecret(),
                ]),
            'endpoints' => [
                ['method' => 'GET', 'path' => '/file'],
                ['method' => 'POST', 'path' => '/file'],
                ['method' => 'POST', 'path' => '/file/base64'],
                ['method' => 'GET', 'path' => '/file/presigned-url'],
                ['method' => 'POST', 'path' => '/logs'],
                ['method' => 'POST', 'path' => '/logs/discord'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'scopes' => ['nullable', 'array'],
            'scopes.*' => ['string', 'in:media,logs,sdk,*'],
        ]);

        $team = $this->teams->defaultTeamFor($request->user());
        $scopes = $validated['scopes'] ?? ['media', 'logs', 'sdk'];

        [, $plainTextToken] = ApiToken::issue($team, $request->user(), $validated['name'], $scopes);

        return back()->with('api_token', $plainTextToken);
    }

    public function destroy(Request $request, ApiToken $apiToken): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($apiToken->team_id === $team->id, 404);

        $apiToken->forceFill(['revoked_at' => now()])->save();

        return back()->with('success', 'API key revoked.');
    }

    public function secret(Request $request, ApiToken $apiToken): JsonResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($apiToken->team_id === $team->id, 404);
        abort_if($apiToken->revoked_at !== null, 404);

        if (! $apiToken->encrypted_token) {
            return response()->json([
                'status' => 'ok',
                'available' => false,
                'token' => null,
                'message' => 'This API key was created before encrypted reveal support. Create a new key to reveal it later.',
            ]);
        }

        return response()->json([
            'status' => 'ok',
            'available' => true,
            'token' => $apiToken->encrypted_token,
        ]);
    }
}
