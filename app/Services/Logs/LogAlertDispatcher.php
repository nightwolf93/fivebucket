<?php

namespace App\Services\Logs;

use App\Models\LogAlertRule;
use App\Models\LogWebhookEndpoint;
use Illuminate\Support\Facades\Http;
use Throwable;

class LogAlertDispatcher
{
    public function sendTest(LogWebhookEndpoint $endpoint): bool
    {
        return $this->sendDiscord($endpoint, [
            'username' => 'FiveBucket',
            'embeds' => [[
                'title' => 'FiveBucket webhook test',
                'description' => 'This endpoint is ready to receive log alerts.',
                'color' => 5793266,
                'timestamp' => now()->toIso8601String(),
            ]],
        ]);
    }

    public function sendAlert(LogAlertRule $rule, int $count, array $samples = []): bool
    {
        $endpoint = $rule->webhookEndpoint;

        if (! $endpoint || ! $endpoint->enabled) {
            return false;
        }

        $description = $this->renderMessage($rule, $count);
        $fields = [
            ['name' => 'Count', 'value' => (string) $count, 'inline' => true],
            ['name' => 'Threshold', 'value' => (string) $rule->threshold_count, 'inline' => true],
            ['name' => 'Window', 'value' => $rule->window_minutes.' min', 'inline' => true],
        ];

        if ($samples !== []) {
            $fields[] = [
                'name' => 'Sample',
                'value' => '```'.substr($this->sampleText($samples[0]), 0, 900).'```',
                'inline' => false,
            ];
        }

        $fields[] = [
            'name' => 'Filters',
            'value' => '```json'."\n".substr(json_encode($rule->filters ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 0, 900)."\n".'```',
            'inline' => false,
        ];

        return $this->sendDiscord($endpoint, [
            'username' => 'FiveBucket',
            'embeds' => [[
                'title' => 'Log alert: '.$rule->name,
                'description' => $description,
                'color' => 15158332,
                'fields' => $fields,
                'timestamp' => now()->toIso8601String(),
            ]],
        ]);
    }

    private function sendDiscord(LogWebhookEndpoint $endpoint, array $payload): bool
    {
        try {
            $response = Http::timeout(8)->asJson()->post($endpoint->url, $payload);
            $ok = $response->successful() || $response->status() === 204;

            $endpoint->forceFill([
                'last_used_at' => now(),
                'last_status_code' => $response->status(),
                'failure_count' => $ok ? 0 : $endpoint->failure_count + 1,
                'last_error' => $ok ? null : substr($response->body(), 0, 1000),
            ])->save();

            return $ok;
        } catch (Throwable $exception) {
            report($exception);

            $endpoint->forceFill([
                'last_used_at' => now(),
                'last_status_code' => null,
                'failure_count' => $endpoint->failure_count + 1,
                'last_error' => substr($exception->getMessage(), 0, 1000),
            ])->save();

            return false;
        }
    }

    private function renderMessage(LogAlertRule $rule, int $count): string
    {
        $template = trim((string) $rule->message_template);

        if ($template === '') {
            return "Rule `{$rule->name}` matched {$count} logs.";
        }

        return strtr($template, [
            '{name}' => $rule->name,
            '{count}' => (string) $count,
            '{threshold}' => (string) $rule->threshold_count,
            '{window}' => (string) $rule->window_minutes,
        ]);
    }

    private function sampleText(array $sample): string
    {
        return trim(implode(' ', array_filter([
            '['.($sample['level'] ?? 'info').']',
            $sample['resource'] ?? null,
            $sample['message'] ?? null,
        ])));
    }
}
