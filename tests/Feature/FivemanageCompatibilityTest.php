<?php

namespace Tests\Feature;

use App\Events\LogsIngested;
use App\Models\ApiToken;
use App\Models\MediaFile;
use App\Models\User;
use App\Services\TeamProvisioner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FivemanageCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_v3_multipart_upload_list_show_and_delete_flow(): void
    {
        [$plainToken] = $this->apiKey();

        $upload = $this->post('/api/v3/file', [
            'file' => UploadedFile::fake()->create('screen.png', 32, 'image/png'),
            'metadata' => json_encode(['player' => 42]),
        ], [
            'Authorization' => $plainToken,
        ]);

        $upload->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure(['data' => ['id', 'url', 'originalUrl']]);

        $fileId = $upload->json('data.id');
        $this->assertDatabaseHas('media_files', ['public_id' => $fileId, 'type' => 'image']);

        $this->getJson('/api/v3/file', ['Authorization' => $plainToken])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/v3/file/'.$fileId, ['Authorization' => $plainToken])
            ->assertOk()
            ->assertJsonPath('data.id', $fileId);

        $this->deleteJson('/api/v3/file/'.$fileId, [], ['Authorization' => $plainToken])
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertSoftDeleted('media_files', ['public_id' => $fileId]);
    }

    public function test_v3_base64_upload_is_accepted(): void
    {
        [$plainToken] = $this->apiKey();

        $this->postJson('/api/v3/file/base64', [
            'base64' => 'data:image/png;base64,'.base64_encode('fivebucket'),
            'filename' => 'evidence.png',
        ], [
            'Authorization' => $plainToken,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure(['data' => ['id', 'url', 'originalUrl']]);

        $this->assertDatabaseHas('media_files', ['filename' => 'evidence.png', 'type' => 'image']);
    }

    public function test_legacy_media_upload_routes_match_fivemanage_shape(): void
    {
        [$plainToken] = $this->apiKey();

        $this->post('/api/image', [
            'image' => UploadedFile::fake()->create('camera.jpg', 32, 'image/jpeg'),
        ], [
            'Authorization' => $plainToken,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure(['data' => ['id', 'url', 'originalUrl'], 'url', 'image']);

        $this->post('/api/video', [
            'video' => UploadedFile::fake()->create('clip.webm', 32, 'video/webm'),
        ], [
            'Authorization' => $plainToken,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure(['data' => ['id', 'url', 'originalUrl'], 'url', 'video']);

        $this->post('/api/audio', [
            'audio' => UploadedFile::fake()->create('voice.webm', 32, 'audio/webm'),
        ], [
            'Authorization' => $plainToken,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure(['data' => ['id', 'url', 'originalUrl'], 'url', 'audio']);

        $this->assertDatabaseHas('media_files', ['filename' => 'camera.jpg', 'type' => 'image']);
        $this->assertDatabaseHas('media_files', ['filename' => 'clip.webm', 'type' => 'video']);
        $this->assertDatabaseHas('media_files', ['filename' => 'voice.webm', 'type' => 'audio']);
    }

    public function test_presigned_upload_accepts_query_api_key_for_generation(): void
    {
        [$plainToken] = $this->apiKey();

        $presigned = $this->getJson('/api/v3/file/presigned-url?apiKey='.$plainToken)
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->json('data.presignedUrl');

        $path = parse_url($presigned, PHP_URL_PATH);

        $this->post($path, [
            'file' => UploadedFile::fake()->create('clip.mp4', 32, 'video/mp4'),
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertDatabaseHas('media_files', ['filename' => 'clip.mp4', 'type' => 'video']);
    }

    public function test_logs_api_accepts_single_and_batch_payloads(): void
    {
        [$plainToken, , $team] = $this->apiKey();

        Event::fake([LogsIngested::class]);

        $this->postJson('/api/logs', [
            'level' => 'warning',
            'message' => 'Player inventory changed',
            'resource' => 'ox_inventory',
            'metadata' => ['playerSource' => 42],
        ], [
            'Authorization' => $plainToken,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->postJson('/api/v3/logs', [
            [
                'level' => 'error',
                'message' => 'Vehicle spawn failed',
                'dataset' => 'vehicles',
                'metadata' => ['model' => 'sultan'],
            ],
        ], [
            'Authorization' => $plainToken,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertDatabaseHas('log_entries', [
            'team_id' => $team->id,
            'level' => 'warn',
            'message' => 'Player inventory changed',
            'resource' => 'ox_inventory',
        ]);

        $this->assertDatabaseHas('log_entries', [
            'team_id' => $team->id,
            'level' => 'error',
            'message' => 'Vehicle spawn failed',
            'resource' => 'vehicles',
        ]);

        Event::assertDispatchedTimes(LogsIngested::class, 2);
    }

    public function test_logs_dashboard_can_filter_entries(): void
    {
        [$plainToken, , $team] = $this->apiKey();
        $user = $team->owner;

        $this->postJson('/api/logs', [
            [
                'level' => 'info',
                'message' => 'Player connected',
                'resource' => 'players',
            ],
            [
                'level' => 'error',
                'message' => 'Database timeout',
                'resource' => 'database',
            ],
        ], [
            'Authorization' => $plainToken,
        ])->assertOk();

        $this->actingAs($user)
            ->get('/logs?level=error&q=timeout')
            ->assertOk()
            ->assertSee('Logs');
    }

    private function apiKey(): array
    {
        Storage::fake('public');
        config([
            'fivebucket.storage_disk' => 'public',
            'fivebucket.public_base_url' => 'http://localhost/storage',
        ]);

        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);

        [$apiToken, $plainToken] = ApiToken::issue($team, $user, 'Test key');

        return [$plainToken, $apiToken, $team];
    }
}
