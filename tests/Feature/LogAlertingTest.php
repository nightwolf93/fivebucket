<?php

namespace Tests\Feature;

use App\Jobs\EvaluateLogAlerts;
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
}
