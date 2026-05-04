<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\SdkActionExecution;
use App\Models\User;
use App\Services\TeamProvisioner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RemoteActionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_sdk_registers_remote_actions_and_polls_dashboard_execution(): void
    {
        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);
        [, $plainToken] = ApiToken::issue($team, $user, 'SDK key', ['sdk']);

        $sdkToken = $this->postJson('/api/sdk/report?endpoint=prod-rp-1&resourceName=admin_tools', [
            'actions' => [[
                'key' => 'announce_rollback',
                'label' => 'Announce rollback',
                'description' => 'Broadcast a rollback warning.',
                'category' => 'Maintenance',
                'dangerous' => true,
                'timeoutSeconds' => 45,
                'schema' => [
                    'fields' => [
                        'minutes' => ['type' => 'integer', 'required' => true, 'min' => 1, 'max' => 120],
                        'reason' => ['type' => 'string', 'max' => 200],
                    ],
                ],
            ]],
        ], ['Authorization' => $plainToken])
            ->assertOk()
            ->assertJsonStructure(['token', 'expiresAt'])
            ->json('token');

        $session = $team->sdkSessions()->with('actions')->firstOrFail();
        $action = $session->actions->first();

        $this->assertSame('announce_rollback', $action->action_key);

        $this->actingAs($user)->get(route('actions.index'))
            ->assertOk();

        $this->actingAs($user)->post(route('actions.store'), [
            'sdk_session_id' => $session->id,
            'action_key' => 'announce_rollback',
            'params' => [
                'minutes' => '5',
                'reason' => 'database restore',
            ],
            'confirm' => true,
        ])->assertRedirect();

        $execution = $team->sdkActionExecutions()->firstOrFail();
        $this->assertSame(SdkActionExecution::STATUS_QUEUED, $execution->status);
        $this->assertSame(5, $execution->params['minutes']);

        $polled = $this->postJson('/api/sdk/actions/poll', [], ['Authorization' => $sdkToken])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('actions.0.actionKey', 'announce_rollback')
            ->json('actions.0');

        $this->assertSame($execution->id, $polled['id']);
        $this->assertSame(SdkActionExecution::STATUS_DELIVERED, $execution->fresh()->status);

        $this->postJson('/api/sdk/actions/'.$execution->id.'/ack', [], ['Authorization' => $sdkToken])
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertSame(SdkActionExecution::STATUS_RUNNING, $execution->fresh()->status);

        $this->postJson('/api/sdk/actions/'.$execution->id.'/result', [
            'ok' => true,
            'result' => [
                'message' => 'Announcement sent',
                'players' => 42,
            ],
        ], ['Authorization' => $sdkToken])
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $execution->refresh();
        $this->assertSame(SdkActionExecution::STATUS_SUCCEEDED, $execution->status);
        $this->assertSame('Announcement sent', $execution->result['message']);
    }
}
