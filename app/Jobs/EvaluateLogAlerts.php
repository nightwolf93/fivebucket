<?php

namespace App\Jobs;

use App\Models\LogAlertRule;
use App\Models\Team;
use App\Services\Logs\LogAlertDispatcher;
use App\Services\Logs\LogFilterMatcher;
use App\Services\Logs\LogStorage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class EvaluateLogAlerts implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly int $teamId,
        private readonly ?int $ruleId = null,
        private readonly bool $force = false,
        private readonly array $logs = [],
    ) {
        $this->onQueue('default');
    }

    public function handle(LogStorage $logs, LogAlertDispatcher $dispatcher, LogFilterMatcher $matcher): void
    {
        $team = Team::query()->find($this->teamId);

        if (! $team) {
            return;
        }

        $rules = $team->logAlertRules()
            ->with('webhookEndpoint')
            ->where('enabled', true)
            ->when($this->ruleId, fn ($query) => $query->whereKey($this->ruleId))
            ->get();

        foreach ($rules as $rule) {
            $this->evaluateRule($team, $rule, $logs, $dispatcher, $matcher);
        }
    }

    private function evaluateRule(Team $team, LogAlertRule $rule, LogStorage $logs, LogAlertDispatcher $dispatcher, LogFilterMatcher $matcher): void
    {
        if (($rule->trigger_mode ?? 'threshold') === 'per_log') {
            $this->evaluatePerLogRule($team, $rule, $logs, $dispatcher, $matcher);

            return;
        }

        $this->evaluateThresholdRule($team, $rule, $logs, $dispatcher);
    }

    private function evaluateThresholdRule(Team $team, LogAlertRule $rule, LogStorage $logs, LogAlertDispatcher $dispatcher): void
    {
        if (! $this->force && $rule->inCooldown()) {
            return;
        }

        $filters = $rule->filters ?? [];
        $filters['from'] = now()->subMinutes(max(1, $rule->window_minutes))->toIso8601String();
        $filters['to'] = now()->toIso8601String();
        unset($filters['timeframe'], $filters['perPage'], $filters['page']);

        $count = $logs->count($team, $filters);
        $rule->forceFill([
            'last_checked_at' => now(),
            'last_count' => $count,
        ])->save();

        if (! $this->force && $count < $rule->threshold_count) {
            return;
        }

        $samples = $logs->export($team, $filters, 3);

        if ($dispatcher->sendAlert($rule, $count, $samples)) {
            $rule->forceFill(['last_triggered_at' => now()])->save();
        }
    }

    private function evaluatePerLogRule(Team $team, LogAlertRule $rule, LogStorage $logs, LogAlertDispatcher $dispatcher, LogFilterMatcher $matcher): void
    {
        $candidates = $this->logs;

        if ($candidates === [] && $this->force) {
            $filters = $rule->filters ?? [];
            $filters['from'] = now()->subMinutes(15)->toIso8601String();
            $filters['to'] = now()->toIso8601String();
            $filters['sort'] = 'newest';
            unset($filters['timeframe'], $filters['perPage'], $filters['page']);
            $candidates = $logs->export($team, $filters, 10);
        }

        if ($candidates === []) {
            return;
        }

        $matches = collect($candidates)
            ->filter(fn ($log) => is_array($log) && $matcher->matches($log, $rule->filters ?? []))
            ->values();

        $sent = 0;
        foreach ($matches as $log) {
            if ($dispatcher->sendLogAlert($rule, $log)) {
                $sent++;
            }
        }

        $rule->forceFill([
            'last_checked_at' => now(),
            'last_count' => $matches->count(),
            'last_triggered_at' => $sent > 0 ? now() : $rule->last_triggered_at,
        ])->save();
    }
}
