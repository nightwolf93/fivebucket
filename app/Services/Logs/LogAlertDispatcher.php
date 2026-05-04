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

        $description = $this->renderAlertMessage(
            $rule->message_template,
            $rule->name,
            $count,
            $rule->threshold_count,
            $rule->window_minutes,
            $samples[0] ?? [],
        );
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

    public function renderAlertMessage(?string $template, string $name, int $count, int $threshold, int $window, array $sample = []): string
    {
        $template = trim((string) $template);

        if ($template === '') {
            return "Rule `{$name}` matched {$count} logs.";
        }

        $context = $this->placeholderContext($name, $count, $threshold, $window, $sample);
        $message = preg_replace_callback('/\{([A-Za-z0-9_.-]+)\}/', function (array $matches) use ($context): string {
            $key = $matches[1];

            return array_key_exists($key, $context) ? $this->stringifyPlaceholder($context[$key]) : $matches[0];
        }, $template) ?? $template;

        return substr($message, 0, 3900);
    }

    private function placeholderContext(string $name, int $count, int $threshold, int $window, array $sample): array
    {
        $context = [
            'name' => $name,
            'count' => $count,
            'threshold' => $threshold,
            'window' => $window,
        ];

        foreach (['id', 'level', 'message', 'resource', 'occurredAt', 'occurredAtIso', 'createdAt'] as $key) {
            if (array_key_exists($key, $sample)) {
                $context[$key] = $sample[$key];
                $context['log.'.$key] = $sample[$key];
                $context['sample.'.$key] = $sample[$key];
            }
        }

        $metadata = $sample['metadata'] ?? [];
        if (is_array($metadata)) {
            $context['metadata'] = $metadata;
            $context['meta'] = $metadata;

            foreach ($this->flatten($metadata) as $path => $value) {
                $context['metadata.'.$path] = $value;
                $context['meta.'.$path] = $value;

                if (! array_key_exists($path, $context)) {
                    $context[$path] = $value;
                }
            }
        }

        return $context;
    }

    private function flatten(array $items, string $prefix = ''): array
    {
        $flattened = [];

        foreach ($items as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix.'.'.$key;

            if (is_array($value)) {
                $flattened += $this->flatten($value, $path);

                continue;
            }

            $flattened[$path] = $value;
        }

        return $flattened;
    }

    private function stringifyPlaceholder(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_array($value) || is_object($value)) {
            return substr(json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '', 0, 800);
        }

        return (string) $value;
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
