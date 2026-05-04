<?php

namespace App\Http\Controllers;

use App\Models\LogWebhookEndpoint;
use App\Services\Logs\LogAlertDispatcher;
use App\Services\TeamProvisioner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LogWebhookEndpointController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly LogAlertDispatcher $dispatcher,
    ) {
    }

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());

        return Inertia::render('Webhooks/Index', [
            'team' => [
                'name' => $team->name,
                'slug' => $team->slug,
            ],
            'endpoints' => $team->logWebhookEndpoints()
                ->withCount('alertRules')
                ->latest()
                ->get()
                ->map(fn (LogWebhookEndpoint $endpoint) => $this->endpointPayload($endpoint)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $team = $this->teams->defaultTeamFor($request->user());

        $team->logWebhookEndpoints()->create($validated);

        return back()->with('success', 'Webhook endpoint created.');
    }

    public function update(Request $request, LogWebhookEndpoint $webhook): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($webhook->team_id === $team->id, 404);

        $validated = $this->validated($request, true);
        if (blank($validated['url'] ?? null)) {
            unset($validated['url']);
        }

        $webhook->update($validated);

        return back()->with('success', 'Webhook endpoint updated.');
    }

    public function destroy(Request $request, LogWebhookEndpoint $webhook): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($webhook->team_id === $team->id, 404);

        $webhook->delete();

        return back()->with('success', 'Webhook endpoint deleted.');
    }

    public function test(Request $request, LogWebhookEndpoint $webhook): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($webhook->team_id === $team->id, 404);

        $ok = $this->dispatcher->sendTest($webhook);

        return back()->with($ok ? 'success' : 'error', $ok ? 'Test webhook sent.' : 'Webhook test failed.');
    }

    private function validated(Request $request, bool $updating = false): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'type' => ['required', 'string', 'in:discord'],
            'url' => [$updating ? 'nullable' : 'required', 'url', 'max:2048', 'regex:/^https:\/\/(discord(app)?\.com|canary\.discord\.com)\/api\/webhooks\//'],
            'enabled' => ['nullable', 'boolean'],
        ]);
    }

    private function endpointPayload(LogWebhookEndpoint $endpoint): array
    {
        return [
            'id' => $endpoint->id,
            'name' => $endpoint->name,
            'type' => $endpoint->type,
            'maskedUrl' => $endpoint->maskedUrl(),
            'enabled' => $endpoint->enabled,
            'lastUsedAt' => $endpoint->last_used_at?->diffForHumans(),
            'lastStatusCode' => $endpoint->last_status_code,
            'failureCount' => $endpoint->failure_count,
            'lastError' => $endpoint->last_error,
            'alertRulesCount' => $endpoint->alert_rules_count ?? 0,
            'createdAt' => $endpoint->created_at?->diffForHumans(),
        ];
    }
}
