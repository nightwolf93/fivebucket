<?php

namespace App\Http\Controllers;

use App\Jobs\EvaluateLogAlerts;
use App\Models\LogAlertRule;
use App\Services\Logs\LogAlertDispatcher;
use App\Services\Logs\LogFilterMatcher;
use App\Services\Logs\LogStorage;
use App\Services\TeamProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LogAlertRuleController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly LogStorage $logs,
        private readonly LogAlertDispatcher $dispatcher,
        private readonly LogFilterMatcher $matcher,
    ) {}

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());

        return Inertia::render('Alerts/Index', [
            'team' => [
                'name' => $team->name,
                'slug' => $team->slug,
            ],
            'rules' => $team->logAlertRules()
                ->with('webhookEndpoint')
                ->latest()
                ->get()
                ->map(fn (LogAlertRule $rule) => $this->rulePayload($rule)),
            'webhooks' => $team->logWebhookEndpoints()
                ->where('enabled', true)
                ->latest()
                ->get()
                ->map(fn ($endpoint) => [
                    'id' => $endpoint->id,
                    'name' => $endpoint->name,
                    'type' => $endpoint->type,
                    'maskedUrl' => $endpoint->maskedUrl(),
                ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $team = $this->teams->defaultTeamFor($request->user());
        $this->assertWebhook($team, $validated['log_webhook_endpoint_id'] ?? null);

        $team->logAlertRules()->create($validated);

        return back()->with('success', 'Alert rule created.');
    }

    public function update(Request $request, LogAlertRule $alert): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($alert->team_id === $team->id, 404);

        $validated = $this->validated($request);
        $this->assertWebhook($team, $validated['log_webhook_endpoint_id'] ?? null);
        $alert->update($validated);

        return back()->with('success', 'Alert rule updated.');
    }

    public function destroy(Request $request, LogAlertRule $alert): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($alert->team_id === $team->id, 404);

        $alert->delete();

        return back()->with('success', 'Alert rule deleted.');
    }

    public function run(Request $request, LogAlertRule $alert): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($alert->team_id === $team->id, 404);

        EvaluateLogAlerts::dispatchSync($team->id, $alert->id, true);

        return back()->with('success', 'Alert evaluation ran.');
    }

    public function preview(Request $request): JsonResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $validated = $request->validate([
            'filters' => ['required', 'array'],
            'name' => ['nullable', 'string', 'max:100'],
            'trigger_mode' => ['nullable', 'string', 'in:threshold,per_log'],
            'message_template' => ['nullable', 'string', 'max:2000'],
            'sample' => ['nullable', 'array'],
            'threshold_count' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'window_minutes' => ['nullable', 'integer', 'min:1', 'max:10080'],
        ]);

        $threshold = max(1, (int) ($validated['threshold_count'] ?? 1));
        $window = max(1, (int) ($validated['window_minutes'] ?? 5));
        $filters = $this->cleanFilters($validated['filters']);
        unset($filters['page'], $filters['perPage'], $filters['timeframe'], $filters['from'], $filters['to']);

        $filters['from'] = now()->subMinutes($window)->toIso8601String();
        $filters['to'] = now()->toIso8601String();
        $filters['sort'] = 'newest';

        if (($validated['trigger_mode'] ?? 'threshold') === 'per_log' && isset($validated['sample'])) {
            $matches = $this->matcher->matches($validated['sample'], $filters);
            $samples = $matches ? [$validated['sample']] : [];

            return response()->json([
                'count' => $matches ? 1 : 0,
                'threshold' => 1,
                'windowMinutes' => 0,
                'willTrigger' => $matches,
                'samples' => $samples,
                'renderedMessage' => $this->dispatcher->renderAlertMessage(
                    $validated['message_template'] ?? '',
                    $validated['name'] ?? 'Preview alert',
                    $matches ? 1 : 0,
                    1,
                    0,
                    $validated['sample'],
                ),
            ]);
        }

        $count = $this->logs->count($team, $filters);
        $samples = $this->logs->export($team, $filters, 3);
        $renderSample = $samples[0] ?? $validated['sample'] ?? [];

        return response()->json([
            'count' => $count,
            'threshold' => $threshold,
            'windowMinutes' => $window,
            'willTrigger' => $count >= $threshold,
            'samples' => $samples,
            'renderedMessage' => $this->dispatcher->renderAlertMessage(
                $validated['message_template'] ?? '',
                $validated['name'] ?? 'Preview alert',
                $count,
                $threshold,
                $window,
                $renderSample,
            ),
        ]);
    }

    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'log_webhook_endpoint_id' => ['required', 'integer'],
            'trigger_mode' => ['nullable', 'string', 'in:threshold,per_log'],
            'filters' => ['required', 'array'],
            'threshold_count' => ['required', 'integer', 'min:1', 'max:100000'],
            'window_minutes' => ['required', 'integer', 'min:1', 'max:10080'],
            'cooldown_minutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'enabled' => ['nullable', 'boolean'],
            'message_template' => ['nullable', 'string', 'max:2000'],
        ]);

        $validated['enabled'] = (bool) ($validated['enabled'] ?? true);
        $validated['trigger_mode'] = $validated['trigger_mode'] ?? 'threshold';
        $validated['filters'] = $this->cleanFilters($validated['filters']);

        return $validated;
    }

    private function cleanFilters(array $filters): array
    {
        unset($filters['page']);

        return collect($filters)
            ->filter(fn ($value) => $value !== null && $value !== '' && $value !== [] && $value !== ['all'])
            ->all();
    }

    private function assertWebhook($team, ?int $webhookId): void
    {
        abort_unless($webhookId && $team->logWebhookEndpoints()->whereKey($webhookId)->exists(), 422);
    }

    private function rulePayload(LogAlertRule $rule): array
    {
        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'triggerMode' => $rule->trigger_mode ?? 'threshold',
            'filters' => $rule->filters,
            'thresholdCount' => $rule->threshold_count,
            'windowMinutes' => $rule->window_minutes,
            'cooldownMinutes' => $rule->cooldown_minutes,
            'enabled' => $rule->enabled,
            'lastTriggeredAt' => $rule->last_triggered_at?->diffForHumans(),
            'lastCount' => $rule->last_count,
            'lastCheckedAt' => $rule->last_checked_at?->diffForHumans(),
            'messageTemplate' => $rule->message_template,
            'webhook' => $rule->webhookEndpoint ? [
                'id' => $rule->webhookEndpoint->id,
                'name' => $rule->webhookEndpoint->name,
                'maskedUrl' => $rule->webhookEndpoint->maskedUrl(),
            ] : null,
            'createdAt' => $rule->created_at?->diffForHumans(),
        ];
    }
}
