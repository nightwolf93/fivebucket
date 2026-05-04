<?php

namespace App\Services\Sdk;

use App\Models\SdkAction;
use App\Models\SdkSession;
use Illuminate\Support\Str;

class RemoteActionRegistry
{
    public function sync(SdkSession $session, mixed $actions): void
    {
        if (! is_array($actions)) {
            return;
        }

        $seen = [];
        $now = now();

        foreach (array_slice($actions, 0, 100) as $action) {
            $normalized = $this->normalizeAction($action);

            if (! $normalized) {
                continue;
            }

            $seen[] = $normalized['action_key'];

            SdkAction::updateOrCreate(
                [
                    'sdk_session_id' => $session->id,
                    'action_key' => $normalized['action_key'],
                ],
                [
                    'team_id' => $session->team_id,
                    'label' => $normalized['label'],
                    'description' => $normalized['description'],
                    'category' => $normalized['category'],
                    'schema' => $normalized['schema'],
                    'metadata' => $normalized['metadata'],
                    'dangerous' => $normalized['dangerous'],
                    'requires_confirmation' => $normalized['requires_confirmation'],
                    'timeout_seconds' => $normalized['timeout_seconds'],
                    'enabled' => true,
                    'last_seen_at' => $now,
                ],
            );
        }

        if ($seen === []) {
            $session->actions()->update(['enabled' => false]);

            return;
        }

        $session->actions()
            ->whereNotIn('action_key', $seen)
            ->update(['enabled' => false]);
    }

    public function normalizeParams(mixed $params, array $schema): array
    {
        $params = is_array($params) ? $params : [];
        $fields = $this->fields($schema);
        $normalized = [];
        $errors = [];

        foreach ($fields as $field) {
            $key = $field['key'];
            $type = $field['type'];
            $required = (bool) ($field['required'] ?? false);
            $value = $params[$key] ?? null;

            if (($value === null || $value === '') && $required) {
                $errors[$key] = 'This parameter is required.';

                continue;
            }

            if ($value === null || $value === '') {
                if (array_key_exists('default', $field)) {
                    $normalized[$key] = $field['default'];
                }

                continue;
            }

            $normalized[$key] = match ($type) {
                'number', 'integer' => $this->number($key, $value, $field, $errors),
                'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
                'select' => $this->select($key, $value, $field, $errors),
                'multiselect' => $this->multiSelect($key, $value, $field, $errors),
                'json', 'object' => $this->json($key, $value, $errors),
                default => $this->string($key, $value, $field, $errors),
            };
        }

        foreach ($params as $key => $value) {
            if (! array_key_exists($key, $normalized) && ! collect($fields)->contains(fn ($field) => $field['key'] === $key)) {
                $normalized[$key] = $value;
            }
        }

        if ($errors !== []) {
            throw new RemoteActionValidationException($errors);
        }

        return $normalized;
    }

    public function fields(array $schema): array
    {
        $fields = $schema['fields'] ?? $schema['params'] ?? $schema;

        if (! is_array($fields)) {
            return [];
        }

        $normalized = [];

        foreach ($fields as $key => $field) {
            if (is_string($field)) {
                $field = ['type' => $field];
            }

            if (! is_array($field)) {
                continue;
            }

            $paramKey = is_string($key) ? $key : ($field['key'] ?? $field['name'] ?? null);
            $paramKey = $this->key($paramKey);

            if (! $paramKey) {
                continue;
            }

            $type = strtolower((string) ($field['type'] ?? 'string'));
            if (! in_array($type, ['string', 'text', 'number', 'integer', 'boolean', 'select', 'multiselect', 'json', 'object', 'player', 'datetime'], true)) {
                $type = 'string';
            }

            $normalized[] = [
                'key' => $paramKey,
                'type' => $type,
                'label' => trim((string) ($field['label'] ?? Str::headline($paramKey))) ?: Str::headline($paramKey),
                'description' => trim((string) ($field['description'] ?? $field['help'] ?? '')),
                'required' => (bool) ($field['required'] ?? false),
                'placeholder' => trim((string) ($field['placeholder'] ?? '')),
                'min' => $field['min'] ?? null,
                'max' => $field['max'] ?? null,
                'default' => $field['default'] ?? null,
                'options' => $this->options($field['options'] ?? []),
                'secret' => (bool) ($field['secret'] ?? false),
            ];
        }

        return array_slice($normalized, 0, 50);
    }

    private function normalizeAction(mixed $action): ?array
    {
        if (! is_array($action)) {
            return null;
        }

        $key = $this->key($action['key'] ?? $action['id'] ?? $action['name'] ?? null);

        if (! $key) {
            return null;
        }

        $schema = ['fields' => $this->fields($action['schema'] ?? $action['params'] ?? [])];

        return [
            'action_key' => $key,
            'label' => Str::limit(trim((string) ($action['label'] ?? Str::headline($key))) ?: Str::headline($key), 255, ''),
            'description' => Str::limit(trim((string) ($action['description'] ?? '')), 2000, ''),
            'category' => Str::limit(trim((string) ($action['category'] ?? 'General')) ?: 'General', 80, ''),
            'schema' => $schema,
            'metadata' => is_array($action['metadata'] ?? null) ? $action['metadata'] : [],
            'dangerous' => (bool) ($action['dangerous'] ?? false),
            'requires_confirmation' => (bool) ($action['requiresConfirmation'] ?? $action['requires_confirmation'] ?? $action['dangerous'] ?? false),
            'timeout_seconds' => max(5, min(600, (int) ($action['timeoutSeconds'] ?? $action['timeout_seconds'] ?? 30))),
        ];
    }

    private function key(mixed $value): ?string
    {
        $key = trim((string) $value);

        if ($key === '' || strlen($key) > 120 || ! preg_match('/^[A-Za-z0-9_.:-]+$/', $key)) {
            return null;
        }

        return $key;
    }

    private function options(mixed $options): array
    {
        if (! is_array($options)) {
            return [];
        }

        return collect($options)
            ->map(function ($option, $key): ?array {
                if (is_array($option)) {
                    $value = $option['value'] ?? $option['id'] ?? $option['key'] ?? null;
                    $label = $option['label'] ?? $option['name'] ?? $value;
                } else {
                    $value = is_string($key) ? $key : $option;
                    $label = $option;
                }

                if ($value === null || $value === '') {
                    return null;
                }

                return [
                    'value' => (string) $value,
                    'label' => (string) ($label ?: $value),
                ];
            })
            ->filter()
            ->values()
            ->take(100)
            ->all();
    }

    private function string(string $key, mixed $value, array $field, array &$errors): string
    {
        $value = trim((string) $value);
        $max = $field['max'] ?? null;

        if (is_numeric($max) && strlen($value) > (int) $max) {
            $errors[$key] = 'This parameter is too long.';
        }

        return $value;
    }

    private function number(string $key, mixed $value, array $field, array &$errors): int|float
    {
        if (! is_numeric($value)) {
            $errors[$key] = 'This parameter must be a number.';

            return 0;
        }

        $number = $field['type'] === 'integer' ? (int) $value : (float) $value;

        if (is_numeric($field['min'] ?? null) && $number < (float) $field['min']) {
            $errors[$key] = 'This parameter is below the minimum.';
        }

        if (is_numeric($field['max'] ?? null) && $number > (float) $field['max']) {
            $errors[$key] = 'This parameter is above the maximum.';
        }

        return $number;
    }

    private function select(string $key, mixed $value, array $field, array &$errors): string
    {
        $value = (string) $value;
        $allowed = collect($field['options'] ?? [])->pluck('value')->all();

        if ($allowed !== [] && ! in_array($value, $allowed, true)) {
            $errors[$key] = 'This parameter has an invalid value.';
        }

        return $value;
    }

    private function multiSelect(string $key, mixed $value, array $field, array &$errors): array
    {
        $values = is_array($value) ? $value : preg_split('/[,|]/', (string) $value);
        $values = collect($values ?: [])->map(fn ($item) => trim((string) $item))->filter()->values()->all();
        $allowed = collect($field['options'] ?? [])->pluck('value')->all();

        if ($allowed !== [] && collect($values)->contains(fn ($item) => ! in_array($item, $allowed, true))) {
            $errors[$key] = 'This parameter has invalid values.';
        }

        return $values;
    }

    private function json(string $key, mixed $value, array &$errors): array
    {
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        if (! is_array($decoded)) {
            $errors[$key] = 'This parameter must be valid JSON.';

            return [];
        }

        return $decoded;
    }
}
