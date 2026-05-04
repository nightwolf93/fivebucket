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
            && str_contains(json_encode($request->data()), 'Exploit detected'));

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
            ->assertJsonCount(1, 'samples');
    }
}
