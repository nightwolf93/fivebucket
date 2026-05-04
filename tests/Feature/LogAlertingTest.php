<?php

namespace Tests\Feature;

use App\Jobs\EvaluateLogAlerts;
use App\Models\ApiToken;
use App\Models\LogAlertRule;
use App\Models\LogEntry;
use App\Models\LogWebhookEndpoint;
use App\Models\User;
use App\Services\TeamProvisioner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LogAlertingTest extends TestCase
{
    use RefreshDatabase;

    public function test_alert_rule_posts_to_configured_discord_webhook(): void
    {
        Http::fake([
            'discord.com/api/webhooks/*' => Http::response('', 204),
        ]);

        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);
        $webhook = LogWebhookEndpoint::create([
            'team_id' => $team->id,
            'name' => 'Security channel',
            'type' => 'discord',
            'url' => 'https://discord.com/api/webhooks/123/test-token',
            'enabled' => true,
        ]);

        $rule = LogAlertRule::create([
            'team_id' => $team->id,
            'log_webhook_endpoint_id' => $webhook->id,
            'name' => 'Exploit detected',
            'filters' => [
                'level' => 'error',
                'metadataFilters' => [
                    ['key' => 'action', 'operator' => 'exact', 'value' => 'exploit_detected'],
                    ['key' => 'cash', 'operator' => 'gt', 'value' => '100'],
                ],
            ],
            'threshold_count' => 1,
            'window_minutes' => 10,
            'cooldown_minutes' => 0,
            'enabled' => true,
            'message_template' => 'Exploit {action} from char {charId} with cash {metadata.cash} on {resource}.',
        ]);

        LogEntry::create([
            'team_id' => $team->id,
            'level' => 'error',
            'message' => 'exploit pattern found',
            'resource' => 'nw_illegal',
            'metadata' => ['action' => 'exploit_detected', 'cash' => 250, 'charId' => 1],
            'occurred_at' => now(),
        ]);

        EvaluateLogAlerts::dispatchSync($team->id);

        Http::assertSent(fn ($request) => str_contains($request->url(), 'discord.com/api/webhooks/123/test-token')
            && str_contains(json_encode($request->data()), 'Exploit exploit_detected from char 1 with cash 250 on nw_illegal.'));

        $this->assertNotNull($rule->fresh()->last_triggered_at);
        $this->assertSame(0, $webhook->fresh()->failure_count);
    }

    public function test_webhook_and_alert_pages_are_available(): void
    {
        $user = User::factory()->create();
        app(TeamProvisioner::class)->createDefaultTeam($user);

        $this->actingAs($user)->get('/webhooks')->assertOk();
        $this->actingAs($user)->get('/alerts')->assertOk();
    }

    public function test_alert_preview_counts_matching_logs_in_window(): void
    {
        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);

        LogEntry::create([
            'team_id' => $team->id,
            'level' => 'info',
            'message' => '[atm] rope_completed',
            'resource' => 'nw_illegal',
            'metadata' => ['action' => 'rope_completed', 'cash' => 198, 'charId' => 1],
            'occurred_at' => now(),
        ]);
        LogEntry::create([
            'team_id' => $team->id,
            'level' => 'info',
            'message' => '[atm] bootstrap',
            'resource' => 'nw_illegal',
            'metadata' => ['action' => 'bootstrap', 'cash' => 50, 'charId' => 1],
            'occurred_at' => now(),
        ]);

        $this->actingAs($user)
            ->postJson('/alerts/preview', [
                'name' => 'ATM completed',
                'message_template' => 'ATM {action} char={charId} cash={metadata.cash} resource={resource}',
                'filters' => [
                    'level' => 'info',
                    'resource' => 'nw_illegal',
                    'metadataFilters' => [
                        ['key' => 'charId', 'operator' => 'exact', 'value' => '1'],
                        ['key' => 'action', 'operator' => 'exact', 'value' => 'rope_completed'],
                        ['key' => 'cash', 'operator' => 'gt', 'value' => '100'],
                    ],
                ],
                'threshold_count' => 1,
                'window_minutes' => 10,
            ])
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('willTrigger', true)
            ->assertJsonPath('renderedMessage', 'ATM rope_completed char=1 cash=198 resource=nw_illegal')
            ->assertJsonCount(1, 'samples');
    }

    public function test_alert_rule_can_be_created_from_dashboard_payload(): void
    {
        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);
        $webhook = LogWebhookEndpoint::create([
            'team_id' => $team->id,
            'name' => 'Discord alerts',
            'type' => 'discord',
            'url' => 'https://discord.com/api/webhooks/123/test-token',
            'enabled' => true,
        ]);

        $this->actingAs($user)
            ->post('/alerts', [
                'name' => 'ATM completed',
                'log_webhook_endpoint_id' => $webhook->id,
                'filters' => [
                    'level' => 'info',
                    'resource' => 'nw_illegal',
                    'metadataFilters' => [
                        ['key' => 'action', 'operator' => 'exact', 'value' => 'rope_completed'],
                    ],
                ],
                'threshold_count' => 1,
                'window_minutes' => 5,
                'cooldown_minutes' => 10,
                'enabled' => true,
                'message_template' => 'ATM {action} char={charId}',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('log_alert_rules', [
            'team_id' => $team->id,
            'name' => 'ATM completed',
            'message_template' => 'ATM {action} char={charId}',
        ]);
    }

    public function test_per_log_alert_posts_each_matching_ingested_log_without_filter_dump(): void
    {
        Http::fake([
            'discord.com/api/webhooks/*' => Http::response('', 204),
        ]);

        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);
        [, $plainToken] = ApiToken::issue($team, $user, 'Logs key', ['logs']);
        $webhook = LogWebhookEndpoint::create([
            'team_id' => $team->id,
            'name' => 'Moderation audit',
            'type' => 'discord',
            'url' => 'https://discord.com/api/webhooks/456/mod-token',
            'enabled' => true,
        ]);

        $rule = LogAlertRule::create([
            'team_id' => $team->id,
            'log_webhook_endpoint_id' => $webhook->id,
            'name' => 'Admin commands',
            'trigger_mode' => 'per_log',
            'filters' => [
                'level' => 'info',
                'resource' => 'admin',
                'metadataFilters' => [
                    ['key' => 'action', 'operator' => 'exact', 'value' => 'admin_command'],
                ],
            ],
            'threshold_count' => 99,
            'window_minutes' => 60,
            'cooldown_minutes' => 60,
            'enabled' => true,
            'message_template' => 'Admin command: {command} by {moderator} target={targetId}',
        ]);

        $this->postJson('/api/logs', [
            [
                'level' => 'info',
                'resource' => 'admin',
                'message' => 'Moderator used /revive',
                'metadata' => [
                    'action' => 'admin_command',
                    'command' => '/revive',
                    'moderator' => 'Nightwolf',
                    'targetId' => 42,
                ],
            ],
            [
                'level' => 'info',
                'resource' => 'admin',
                'message' => 'Moderator opened menu',
                'metadata' => ['action' => 'menu_open'],
            ],
        ], ['Authorization' => $plainToken])->assertOk();

        Http::assertSentCount(1);
        Http::assertSent(function ($request) {
            $data = $request->data();
            $payload = json_encode($data, JSON_UNESCAPED_SLASHES);
            $embed = $data['embeds'][0] ?? [];

            return str_contains($request->url(), 'discord.com/api/webhooks/456/mod-token')
                && ($embed['description'] ?? '') === 'Admin command: /revive by Nightwolf target=42'
                && collect($embed['fields'] ?? [])->contains(fn ($field) => ($field['name'] ?? '') === 'Triggered log')
                && ! str_contains($payload, 'Filters')
                && ! str_contains($payload, 'metadataFilters');
        });

        $this->assertSame(1, $rule->fresh()->last_count);
        $this->assertNotNull($rule->fresh()->last_triggered_at);
    }
}
